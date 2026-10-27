
import uuid

from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal

from .sku import build_sku


# ==========================================
# CATEGORY MODEL
# ==========================================

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    slug = models.SlugField(max_length=120, unique=True)

    description = models.TextField(blank=True)

    image = models.ImageField(
        upload_to="categories/",
        blank=True,
        null=True
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


# ==========================================
# PRODUCT MODEL
# ==========================================

class Product(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products"
    )

    name = models.CharField(max_length=200)

    slug = models.SlugField(max_length=220, unique=True)

    # Stock Keeping Unit, e.g. "CN-BEV-MANGO-DRINK-1L-00040" (see store/sku.py).
    # Generated automatically when the product is first saved (see save())
    # and never edited by hand.
    sku = models.CharField(
        max_length=48,
        unique=True,
        editable=False,
        verbose_name="SKU",
    )

    description = models.TextField()

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ]
    )

    original_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ]
    )

    image = models.ImageField(
        upload_to="products/",
        blank=True,
        null=True
    )

    stock = models.PositiveIntegerField(default=0)

    unit = models.CharField(
        max_length=50,
        default="piece"
    )

    is_available = models.BooleanField(default=True)

    is_featured = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # The SKU's number is the product id, which only exists after the
        # first insert, so new products are saved with a temporary unique
        # placeholder and then given their real SKU.
        if self.sku:
            return super().save(*args, **kwargs)

        self.sku = f"TMP-{uuid.uuid4().hex[:24]}"
        super().save(*args, **kwargs)

        self.sku = build_sku(self.category.name, self.name, self.pk)
        Product.objects.filter(pk=self.pk).update(sku=self.sku)

    @property
    def in_stock(self):
        return self.is_available and self.stock > 0

    @property
    def discount_percentage(self):
        if (
            self.original_price
            and self.original_price > self.price
        ):
            discount = (
                (self.original_price - self.price)
                / self.original_price
            ) * 100

            return round(discount)

        return 0


# ==========================================
# CUSTOMER PROFILE MODEL
# ==========================================

class CustomerProfile(models.Model):

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_profile"
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
        default=""
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile - {self.user.username}"


# ==========================================
# SAVED DELIVERY ADDRESS MODEL
# ==========================================

class DeliveryAddress(models.Model):

    ADDRESS_TYPE_CHOICES = [
        ("home", "Home"),
        ("work", "Work"),
        ("other", "Other"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="delivery_addresses"
    )

    label = models.CharField(
        max_length=20,
        choices=ADDRESS_TYPE_CHOICES,
        default="home"
    )

    full_name = models.CharField(max_length=150)

    phone = models.CharField(max_length=20)

    address = models.TextField()

    city = models.CharField(max_length=100)

    state = models.CharField(max_length=100)

    postal_code = models.CharField(max_length=20)

    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_default", "-created_at"]

    def __str__(self):
        return (
            f"{self.get_label_display()} - "
            f"{self.full_name} ({self.user.username})"
        )


# ==========================================
# CART MODEL
# ==========================================

class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart - {self.user.username}"

    @property
    def total_items(self):
        return sum(
            item.quantity
            for item in self.items.all()
        )

    @property
    def total_price(self):
        return sum(
            (
                item.subtotal
                for item in self.items.all()
            ),
            Decimal("0.00")
        )


# ==========================================
# CART ITEM MODEL
# ==========================================

class CartItem(models.Model):
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items"
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE
    )

    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)]
    )

    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "product"],
                name="unique_cart_product"
            )
        ]

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

    @property
    def subtotal(self):
        return self.product.price * self.quantity


# ==========================================
# ORDER MODEL
# ==========================================

class Order(models.Model):

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("packed", "Packed"),
        ("shipped", "Shipped"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    ]

    PAYMENT_METHOD_CHOICES = [
        ("cod", "Cash on Delivery"),
    ]

    PAYMENT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("failed", "Failed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders"
    )

    full_name = models.CharField(max_length=150)

    phone = models.CharField(max_length=20)

    address = models.TextField()

    city = models.CharField(max_length=100)

    state = models.CharField(max_length=100)

    postal_code = models.CharField(max_length=20)

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ]
    )

    # New orders start as confirmed.

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="confirmed"
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        default="cod"
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="pending"
    )

    # ==========================================
    # CANCELLATION INFORMATION
    # ==========================================

    cancellation_reason = models.TextField(
        blank=True,
        default=""
    )

    cancelled_at = models.DateTimeField(
        blank=True,
        null=True
    )

    # ==========================================
    # EMPLOYEE ASSIGNMENT
    # ==========================================

    # The employee packing this order. Kept after packing as a record
    # of who handled it; cleared if the order goes back to the queue.
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="assigned_orders"
    )

    assigned_at = models.DateTimeField(
        blank=True,
        null=True
    )

    # The delivery staff member taking this order from Packed to Delivered.
    delivery_person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="delivery_orders"
    )

    delivery_assigned_at = models.DateTimeField(
        blank=True,
        null=True
    )

    # ==========================================
    # TRACKING TIMES (Placed → Packed → Shipped → Delivered)
    # ==========================================

    packed_at = models.DateTimeField(blank=True, null=True)

    shipped_at = models.DateTimeField(blank=True, null=True)

    delivered_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    # Customers may cancel until the order is shipped.
    CUSTOMER_CANCELLABLE_STATUSES = (
        "pending",
        "confirmed",
        "packed",
    )

    # Orders still waiting to be packed. These are the ones that sit in
    # the packing queue and occupy an employee while assigned.
    OPEN_STATUSES = (
        "pending",
        "confirmed",
    )

    # Orders packed but not yet delivered. These sit in the delivery queue
    # and occupy a delivery staff member while assigned.
    DELIVERY_STATUSES = (
        "packed",
        "shipped",
    )

    class Meta:
        ordering = ["-created_at"]

        constraints = [
            # An employee can hold only one unpacked order at a time.
            models.UniqueConstraint(
                fields=["assigned_to"],
                condition=models.Q(status__in=["pending", "confirmed"]),
                name="one_open_order_per_employee",
            ),
            # A delivery staff member can hold only one undelivered order at a time.
            models.UniqueConstraint(
                fields=["delivery_person"],
                condition=models.Q(status__in=["packed", "shipped"]),
                name="one_active_delivery_per_person",
            ),
        ]

    def __str__(self):
        return f"Order #{self.id} - {self.user.username}"

    @property
    def can_be_cancelled_by_customer(self):
        return self.status in self.CUSTOMER_CANCELLABLE_STATUSES


# ==========================================
# ORDER ITEM MODEL
# ==========================================

class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items"
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT
    )

    product_name = models.CharField(max_length=200)

    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[
            MinValueValidator(Decimal("0.00"))
        ]
    )

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"

    @property
    def subtotal(self):
        return self.price * self.quantity


# ==========================================
# WISHLIST MODEL
# ==========================================

class Wishlist(models.Model):

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wishlist_items"
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="wishlist_items"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

        constraints = [
            models.UniqueConstraint(
                fields=["user", "product"],
                name="unique_wishlist_user_product"
            )
        ]

    def __str__(self):
        return (
            f"{self.user.username} - "
            f"{self.product.name}"
        )

# ==========================================
# PRODUCT REVIEW MODEL
# ==========================================

class ProductReview(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="product_reviews"
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="reviews"
    )

    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )

    comment = models.TextField(max_length=2000)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "product"],
                name="unique_review_user_product"
            )
        ]

    def __str__(self):
        return f"{self.product.name}: {self.rating}/5 by {self.user.username}"


# ==========================================
# STORE SETTINGS (SINGLE CONFIGURATION)
# ==========================================

class StoreSettings(models.Model):
    store_name = models.CharField(max_length=120, default="CartNest")
    support_email = models.EmailField(blank=True, default="")
    support_phone = models.CharField(max_length=30, blank=True, default="")
    store_address = models.TextField(blank=True, default="")
    delivery_fee = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal("0.00"), validators=[MinValueValidator(Decimal("0.00"))])
    free_delivery_threshold = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"), validators=[MinValueValidator(Decimal("0.00"))])
    announcement = models.CharField(max_length=255, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.store_name


# ==========================================
# ADMIN NOTIFICATIONS
# ==========================================

class AdminNotification(models.Model):

    TYPE_CHOICES = [
        ("new_order", "New order"),
    ]

    notification_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        default="new_order"
    )

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="admin_notifications"
    )

    title = models.CharField(max_length=150)

    message = models.CharField(max_length=255)

    # Shared by all store staff: one person reading it clears it for the team.
    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.title


# ==========================================
# STORE STAFF (EMPLOYEES AND MANAGERS)
# ==========================================

class StaffProfile(models.Model):

    ROLE_CHOICES = [
        ("employee", "Employee"),
        ("delivery", "Delivery Staff"),
        ("manager", "Manager"),
    ]

    # Accounts added by a manager wait for an admin's approval and cannot
    # sign in until then. Accounts added by an admin are approved at once.
    APPROVAL_CHOICES = [
        ("pending", "Pending approval"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    # Staff accounts are not Django staff (is_staff=False), so they cannot
    # reach the Django admin site. Their role lives here instead.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_profile"
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="employee"
    )

    phone = models.CharField(
        max_length=20,
        blank=True,
        default=""
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="created_staff_profiles"
    )

    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_CHOICES,
        default="approved"
    )

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="approved_staff_profiles"
    )

    approved_at = models.DateTimeField(blank=True, null=True)

    # Shift status: only punched-in employees and delivery staff
    # receive orders.
    is_punched_in = models.BooleanField(default=False)

    punched_in_at = models.DateTimeField(blank=True, null=True)

    punched_out_at = models.DateTimeField(blank=True, null=True)

    # Used to rotate orders: the employee who waited longest goes next.
    last_assigned_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["role", "user__username"]

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"


def get_user_role(user):
    """Return "admin", "manager", "employee" or "customer"."""

    if not user or not user.is_authenticated:
        return None

    if user.is_staff:
        return "admin"

    try:
        return user.staff_profile.role
    except StaffProfile.DoesNotExist:
        return "customer"


# ==========================================
# STOCK ACTIVITY LOG
# ==========================================

class StockLog(models.Model):

    ACTION_CHOICES = [
        ("product_created", "Product added"),
        ("product_updated", "Product updated"),
        ("product_deleted", "Product removed"),
        ("stock_added", "Stock added"),
        ("stock_removed", "Stock removed"),
    ]

    # Kept when the product is deleted, so the history survives.
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="stock_logs"
    )

    product_name = models.CharField(max_length=200)

    action = models.CharField(
        max_length=30,
        choices=ACTION_CHOICES
    )

    quantity_change = models.IntegerField(default=0)

    stock_before = models.PositiveIntegerField(default=0)

    stock_after = models.PositiveIntegerField(default=0)

    note = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )

    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="stock_logs"
    )

    # Snapshot of who did it, in case the account is deleted later.
    performed_by_name = models.CharField(max_length=150, blank=True, default="")

    performed_by_role = models.CharField(max_length=20, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.get_action_display()}: {self.product_name}"


# ==========================================
# STAFF ATTENDANCE (ONE ROW PER SHIFT)
# ==========================================

class ShiftRecord(models.Model):

    # Created when a store staff or delivery staff member punches in, and
    # closed when they punch out. The monthly attendance report reads these.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shift_records"
    )

    # The role at the time of the shift ("employee" or "delivery").
    role = models.CharField(max_length=20)

    punched_in_at = models.DateTimeField()

    # Empty while the shift is still going on.
    punched_out_at = models.DateTimeField(blank=True, null=True)

    # Days from before attendance was recorded, inferred from the orders the
    # person packed or delivered. They count as present but have no hours,
    # because the real punch times are not known.
    is_estimated = models.BooleanField(default=False)

    note = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-punched_in_at"]

        constraints = [
            # Nobody can have two shifts open at once.
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(punched_out_at__isnull=True),
                name="one_open_shift_per_user",
            )
        ]

    def __str__(self):
        return f"{self.user.username}: {self.punched_in_at:%Y-%m-%d %H:%M}"
