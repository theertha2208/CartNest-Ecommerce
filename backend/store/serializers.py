
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Category,
    Product,
    CustomerProfile,
    DeliveryAddress,
    Cart,
    CartItem,
    Order,
    OrderItem,
    Wishlist,
    ProductReview,
    StoreSettings,
    AdminNotification,
    StaffProfile,
    StockLog,
    get_user_role,
)


User = get_user_model()


# ==========================================
# SHARED VALIDATION HELPERS
# ==========================================

def validate_indian_phone(value):
    cleaned = value.replace(" ", "").replace("-", "")

    if cleaned.startswith("+91"):
        cleaned = cleaned[3:]

    elif cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]

    if not (
        cleaned.isascii()
        and cleaned.isdigit()
        and len(cleaned) == 10
        and cleaned[0] in "6789"
    ):
        raise serializers.ValidationError(
            "Enter a valid 10-digit Indian mobile number."
        )

    return cleaned


def validate_indian_pin(value):
    if not (
        value.isascii()
        and value.isdigit()
        and len(value) == 6
        and value[0] != "0"
    ):
        raise serializers.ValidationError(
            "Enter a valid 6-digit Indian PIN code."
        )

    return value


def validate_delivery_street(value):
    if len(value.strip()) < 10:
        raise serializers.ValidationError(
            "Please enter a complete delivery address."
        )

    return value


# ==========================================
# USER SERIALIZER
# ==========================================

class UserSerializer(serializers.ModelSerializer):

    role = serializers.SerializerMethodField()

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
        ]

        read_only_fields = [
            "id",
            "role",
        ]

    def get_role(self, obj):
        return get_user_role(obj)


# ==========================================
# REGISTER SERIALIZER
# ==========================================

class RegisterSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )

    confirm_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "password",
            "confirm_password",
        ]

        read_only_fields = ["id"]

    def validate_email(self, value):

        if User.objects.filter(
            email__iexact=value
        ).exists():

            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate(self, attrs):

        if attrs["password"] != attrs["confirm_password"]:

            raise serializers.ValidationError({
                "confirm_password": "Passwords do not match."
            })

        user = User(
            username=attrs.get("username", ""),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
            email=attrs.get("email", ""),
        )

        validate_password(
            attrs["password"],
            user=user,
        )

        return attrs

    def create(self, validated_data):

        validated_data.pop("confirm_password")

        password = validated_data.pop("password")

        return User.objects.create_user(
            password=password,
            is_staff=False,
            is_superuser=False,
            **validated_data,
        )


# ==========================================
# LOGIN SERIALIZER
# ==========================================

class CartNestTokenSerializer(TokenObtainPairSerializer):

    def validate(self, attrs):

        # Staff added by a manager cannot sign in until an admin approves
        # them. Say so, but only to someone who knows the password.
        account = User.objects.filter(
            username=attrs.get("username", ""),
            staff_profile__approval_status__in=["pending", "rejected"],
        ).select_related("staff_profile").first()

        if account and account.check_password(attrs.get("password", "")):
            raise AuthenticationFailed(
                "Your account is waiting for admin approval."
                if account.staff_profile.approval_status == "pending"
                else "Your account request was not approved. Please contact the store admin."
            )

        data = super().validate(attrs)

        data["user"] = UserSerializer(
            self.user
        ).data

        return data


# ==========================================
# CUSTOMER PROFILE SERIALIZER
# ==========================================

class CustomerProfileSerializer(serializers.ModelSerializer):

    id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    first_name = serializers.CharField(
        source="user.first_name",
        max_length=150,
        allow_blank=True,
        required=False,
    )

    last_name = serializers.CharField(
        source="user.last_name",
        max_length=150,
        allow_blank=True,
        required=False,
    )

    email = serializers.EmailField(
        source="user.email",
        required=False,
        allow_blank=False,
    )

    role = serializers.SerializerMethodField()

    class Meta:
        model = CustomerProfile

        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "role",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "username",
            "role",
            "created_at",
            "updated_at",
        ]

    def get_role(self, obj):
        return get_user_role(obj.user)

    def validate_email(self, value):

        user = self.instance.user if self.instance else None

        queryset = User.objects.filter(
            email__iexact=value
        )

        if user:
            queryset = queryset.exclude(pk=user.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "Another account already uses this email."
            )

        return value

    def validate_phone(self, value):

        if not value.strip():
            return ""

        return validate_indian_phone(value)

    def update(self, instance, validated_data):

        user_data = validated_data.pop("user", {})

        user = instance.user

        for field in ["first_name", "last_name", "email"]:
            if field in user_data:
                setattr(user, field, user_data[field])

        if user_data:
            user.save(
                update_fields=list(user_data.keys())
            )

        if "phone" in validated_data:
            instance.phone = validated_data["phone"]
            instance.save(
                update_fields=["phone", "updated_at"]
            )

        return instance


# ==========================================
# SAVED DELIVERY ADDRESS SERIALIZER
# ==========================================

class DeliveryAddressSerializer(serializers.ModelSerializer):

    class Meta:
        model = DeliveryAddress

        fields = [
            "id",
            "label",
            "full_name",
            "phone",
            "address",
            "city",
            "state",
            "postal_code",
            "is_default",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    def validate_phone(self, value):
        return validate_indian_phone(value)

    def validate_postal_code(self, value):
        return validate_indian_pin(value)

    def validate_address(self, value):
        return validate_delivery_street(value)

    def validate(self, attrs):

        for field in ["full_name", "city", "state"]:
            if field in attrs:
                if not attrs[field].strip():
                    raise serializers.ValidationError({
                        field: "This field cannot be empty."
                    })

        return attrs


# ==========================================
# CATEGORY SERIALIZER
# ==========================================

class CategorySerializer(serializers.ModelSerializer):

    class Meta:
        model = Category

        fields = [
            "id",
            "name",
            "slug",
            "description",
            "image",
            "is_active",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]


# ==========================================
# PRODUCT SERIALIZER
# ==========================================

class ProductSerializer(serializers.ModelSerializer):

    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
    )

    in_stock = serializers.BooleanField(
        read_only=True,
    )

    discount_percentage = serializers.IntegerField(
        read_only=True,
    )

    class Meta:
        model = Product

        fields = [
            "id",
            "category",
            "category_name",
            "sku",
            "name",
            "slug",
            "description",
            "price",
            "original_price",
            "image",
            "stock",
            "unit",
            "is_available",
            "is_featured",
            "in_stock",
            "discount_percentage",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "sku",
            "category_name",
            "in_stock",
            "discount_percentage",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):

        price = attrs.get(
            "price",
            getattr(self.instance, "price", None),
        )

        original_price = attrs.get(
            "original_price",
            getattr(self.instance, "original_price", None),
        )

        if (
            original_price is not None
            and price is not None
            and original_price < price
        ):

            raise serializers.ValidationError({
                "original_price":
                "Original price cannot be less than the selling price."
            })

        return attrs


# ==========================================
# WISHLIST SERIALIZER - NEW
# ==========================================

class WishlistSerializer(serializers.ModelSerializer):

    product = ProductSerializer(
        read_only=True
    )

    product_id = serializers.IntegerField(
        source="product.id",
        read_only=True,
    )

    class Meta:
        model = Wishlist

        fields = [
            "id",
            "product_id",
            "product",
            "created_at",
        ]

        read_only_fields = fields


# ==========================================
# ADD TO WISHLIST SERIALIZER - NEW
# ==========================================

class AddToWishlistSerializer(serializers.Serializer):

    product_id = serializers.IntegerField(
        min_value=1
    )

    def validate_product_id(self, value):

        try:
            product = Product.objects.select_related(
                "category"
            ).get(id=value)

        except Product.DoesNotExist:
            raise serializers.ValidationError(
                "Product not found."
            )

        if (
            not product.is_available
            or not product.category.is_active
        ):
            raise serializers.ValidationError(
                "This product is not available."
            )

        return value


# ==========================================
# PRODUCT REVIEW SERIALIZERS
# ==========================================

class ProductReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="product.name", read_only=True)
    verified_purchase = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = [
            "id",
            "product",
            "product_name",
            "customer_name",
            "rating",
            "comment",
            "verified_purchase",
            "is_mine",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_customer_name(self, obj):
        name = obj.user.get_full_name().strip()
        return name or obj.user.username

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(
            request and request.user.is_authenticated
            and request.user.pk == obj.user_id
        )

    def get_verified_purchase(self, obj):
        return OrderItem.objects.filter(
            order__user=obj.user,
            order__status="delivered",
            product=obj.product,
        ).exists()


class CreateProductReviewSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source="product",
        write_only=True,
    )

    class Meta:
        model = ProductReview
        fields = ["product_id", "rating", "comment"]

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value

    def validate_comment(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Please write a review.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError("Please log in to review a product.")

        product = attrs["product"]
        if not OrderItem.objects.filter(
            order__user=request.user,
            order__status="delivered",
            product=product,
        ).exists():
            raise serializers.ValidationError({
                "product_id": "You can review a product only after it has been delivered to you."
            })

        if ProductReview.objects.filter(user=request.user, product=product).exists():
            raise serializers.ValidationError({
                "product_id": "You have already reviewed this product. You can edit your existing review."
            })

        return attrs

    def create(self, validated_data):
        return ProductReview.objects.create(
            user=self.context["request"].user,
            **validated_data,
        )


class UpdateProductReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductReview
        fields = ["rating", "comment"]

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value

    def validate_comment(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Please write a review.")
        return value


# ==========================================
# CART ITEM SERIALIZER
# ==========================================

class CartItemSerializer(serializers.ModelSerializer):

    product_id = serializers.IntegerField(
        source="product.id",
        read_only=True,
    )

    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    product_image = serializers.ImageField(
        source="product.image",
        read_only=True,
    )

    product_price = serializers.DecimalField(
        source="product.price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    product_stock = serializers.IntegerField(
        source="product.stock",
        read_only=True,
    )

    product_unit = serializers.CharField(
        source="product.unit",
        read_only=True,
    )

    subtotal = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = CartItem

        fields = [
            "id",
            "product_id",
            "product_name",
            "product_image",
            "product_price",
            "product_stock",
            "product_unit",
            "quantity",
            "subtotal",
            "added_at",
        ]

        read_only_fields = [
            "id",
            "product_id",
            "product_name",
            "product_image",
            "product_price",
            "product_stock",
            "product_unit",
            "subtotal",
            "added_at",
        ]


# ==========================================
# CART SERIALIZER
# ==========================================

class CartSerializer(serializers.ModelSerializer):

    items = CartItemSerializer(
        many=True,
        read_only=True,
    )

    total_items = serializers.IntegerField(
        read_only=True,
    )

    total_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Cart

        fields = [
            "id",
            "items",
            "total_items",
            "total_price",
            "created_at",
            "updated_at",
        ]

        read_only_fields = fields


# ==========================================
# ADD TO CART SERIALIZER
# ==========================================

class AddToCartSerializer(serializers.Serializer):

    product_id = serializers.IntegerField(
        min_value=1,
    )

    quantity = serializers.IntegerField(
        min_value=1,
        default=1,
    )

    def validate(self, attrs):

        product_id = attrs["product_id"]

        quantity = attrs["quantity"]

        try:
            product = Product.objects.select_related(
                "category"
            ).get(id=product_id)

        except Product.DoesNotExist:

            raise serializers.ValidationError({
                "product_id": "Product not found."
            })

        if (
            not product.is_available
            or not product.category.is_active
        ):

            raise serializers.ValidationError({
                "product_id": "This product is not available."
            })

        if product.stock < quantity:

            raise serializers.ValidationError({
                "quantity":
                f"Only {product.stock} items are available."
            })

        attrs["product"] = product

        return attrs


# ==========================================
# UPDATE CART ITEM SERIALIZER
# ==========================================

class UpdateCartItemSerializer(serializers.Serializer):

    quantity = serializers.IntegerField(
        min_value=1,
    )


# ==========================================
# ORDER ITEM SERIALIZER
# ==========================================

class OrderItemSerializer(serializers.ModelSerializer):

    product_id = serializers.IntegerField(
        source="product.id",
        read_only=True,
    )

    product_image = serializers.ImageField(
        source="product.image",
        read_only=True,
    )

    subtotal = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = OrderItem

        fields = [
            "id",
            "product_id",
            "product_name",
            "product_image",
            "quantity",
            "price",
            "subtotal",
        ]

        read_only_fields = fields


# ==========================================
# ORDER SERIALIZER
# ==========================================

class OrderSerializer(serializers.ModelSerializer):

    items = OrderItemSerializer(
        many=True,
        read_only=True,
    )

    customer_username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    can_cancel = serializers.BooleanField(
        source="can_be_cancelled_by_customer",
        read_only=True,
    )

    class Meta:
        model = Order

        fields = [
            "id",
            "customer_username",
            "full_name",
            "phone",
            "address",
            "city",
            "state",
            "postal_code",
            "total_amount",
            "status",
            "payment_method",
            "payment_status",
            "cancellation_reason",
            "cancelled_at",
            "can_cancel",
            "items",
            "created_at",
            "packed_at",
            "shipped_at",
            "delivered_at",
            "updated_at",
        ]

        read_only_fields = fields


# ==========================================
# STAFF ORDER SERIALIZER (WITH ASSIGNMENT DETAILS)
# ==========================================

class StaffOrderSerializer(OrderSerializer):

    # Customers never see which employee handled their order.
    assigned_to_name = serializers.SerializerMethodField()

    class Meta(OrderSerializer.Meta):

        fields = OrderSerializer.Meta.fields + [
            "assigned_to",
            "assigned_to_name",
            "assigned_at",
            "delivery_person",
            "delivery_person_name",
            "delivery_assigned_at",
        ]

        read_only_fields = fields

    delivery_person_name = serializers.SerializerMethodField()

    def get_assigned_to_name(self, obj):
        return display_name(obj.assigned_to)

    def get_delivery_person_name(self, obj):
        return display_name(obj.delivery_person)


def display_name(user):
    if user is None:
        return ""

    return user.get_full_name() or user.username


class OrderAssignSerializer(serializers.Serializer):

    # A person's user id, or null to put the order back in the queue.
    employee = serializers.IntegerField(allow_null=True)

    # Which queue: packing (employees) or delivery (delivery staff).
    lane = serializers.ChoiceField(
        choices=["packing", "delivery"],
        default="packing",
    )


class StaffApprovalSerializer(serializers.Serializer):

    decision = serializers.ChoiceField(choices=["approve", "reject"])


# ==========================================
# CUSTOMER ORDER CANCELLATION SERIALIZER
# ==========================================

class CustomerOrderCancelSerializer(serializers.Serializer):

    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
        max_length=500,
    )


# ==========================================
# CHECKOUT SERIALIZER
# ==========================================

class CheckoutSerializer(serializers.Serializer):

    full_name = serializers.CharField(
        max_length=150,
        allow_blank=False,
        trim_whitespace=True,
    )

    phone = serializers.CharField(
        max_length=20,
        allow_blank=False,
        trim_whitespace=True,
    )

    address = serializers.CharField(
        allow_blank=False,
        trim_whitespace=True,
    )

    city = serializers.CharField(
        max_length=100,
        allow_blank=False,
        trim_whitespace=True,
    )

    state = serializers.CharField(
        max_length=100,
        allow_blank=False,
        trim_whitespace=True,
    )

    postal_code = serializers.CharField(
        max_length=20,
        allow_blank=False,
        trim_whitespace=True,
    )

    payment_method = serializers.ChoiceField(
        choices=["cod"],
        default="cod",
    )

    def validate_phone(self, value):
        return validate_indian_phone(value)

    def validate_postal_code(self, value):
        return validate_indian_pin(value)

    def validate_address(self, value):
        return validate_delivery_street(value)


# ==========================================
# ADMIN ORDER STATUS UPDATE SERIALIZER
# ==========================================

class OrderStatusUpdateSerializer(serializers.ModelSerializer):

    cancellation_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
        max_length=1000,
    )

    class Meta:
        model = Order

        fields = [
            "status",
            "cancellation_reason",
        ]

    def validate_status(self, value):

        if self.instance:
            current_status = self.instance.status

            if current_status == "cancelled":
                raise serializers.ValidationError(
                    "A cancelled order cannot be updated."
                )

            if current_status == "delivered":
                raise serializers.ValidationError(
                    "A delivered order cannot be updated."
                )

            allowed_transitions = {
                # Supports orders created before the new workflow.
                "pending": ["confirmed", "cancelled"],

                # New orders start as confirmed.
                "confirmed": ["packed", "cancelled"],

                "packed": ["shipped", "cancelled"],

                # Shipped orders cannot be cancelled directly.
                "shipped": ["delivered"],
            }

            allowed = allowed_transitions.get(
                current_status,
                [],
            )

            if value not in allowed:
                raise serializers.ValidationError(
                    f"Cannot change order status from "
                    f"'{current_status}' to '{value}'."
                )

        return value

    def validate(self, attrs):

        status = attrs.get("status")

        reason = attrs.get(
            "cancellation_reason",
            ""
        ).strip()

        if status == "cancelled":

            if not reason:
                raise serializers.ValidationError({
                    "cancellation_reason":
                    "Please provide a reason for cancelling this order."
                })

            attrs["cancellation_reason"] = reason

        elif reason:
            raise serializers.ValidationError({
                "cancellation_reason":
                "A cancellation reason can only be provided when cancelling an order."
            })

        return attrs


class StoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        fields = ["store_name", "support_email", "support_phone", "store_address", "delivery_fee", "free_delivery_threshold", "announcement", "updated_at"]
        read_only_fields = ["updated_at"]


# ==========================================
# ADMIN NOTIFICATION SERIALIZER
# ==========================================

class AdminNotificationSerializer(serializers.ModelSerializer):

    order_id = serializers.IntegerField(
        source="order.id",
        read_only=True,
    )

    order_total = serializers.DecimalField(
        source="order.total_amount",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    order_status = serializers.CharField(
        source="order.status",
        read_only=True,
    )

    class Meta:
        model = AdminNotification

        fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "order_id",
            "order_total",
            "order_status",
            "is_read",
            "created_at",
        ]

        read_only_fields = fields


# ==========================================
# STAFF ACCOUNT SERIALIZER (ADMIN ONLY)
# ==========================================

class StaffAccountSerializer(serializers.ModelSerializer):

    role = serializers.ChoiceField(
        choices=StaffProfile.ROLE_CHOICES,
        source="staff_profile.role",
    )

    phone = serializers.CharField(
        source="staff_profile.phone",
        max_length=20,
        allow_blank=True,
        required=False,
    )

    # Required when creating; optional when editing (resets the password).
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"},
    )

    full_name = serializers.SerializerMethodField()

    created_by = serializers.CharField(
        source="staff_profile.created_by.username",
        read_only=True,
        default="",
    )

    approval_status = serializers.CharField(
        source="staff_profile.approval_status",
        read_only=True,
    )

    approved_by = serializers.CharField(
        source="staff_profile.approved_by.username",
        read_only=True,
        default="",
    )

    is_punched_in = serializers.BooleanField(
        source="staff_profile.is_punched_in",
        read_only=True,
    )

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "role",
            "password",
            "is_active",
            "approval_status",
            "approved_by",
            "is_punched_in",
            "date_joined",
            "last_login",
            "created_by",
        ]

        read_only_fields = [
            "id",
            "full_name",
            "approval_status",
            "approved_by",
            "is_punched_in",
            "date_joined",
            "last_login",
            "created_by",
        ]

    def requester_role(self):
        return get_user_role(self.context["request"].user)

    def validate_role(self, value):

        # Managers add staff and delivery staff; only admins add managers.
        if self.requester_role() != "admin" and value == "manager":
            raise serializers.ValidationError(
                "Only an admin can create or promote managers."
            )

        return value

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def validate_email(self, value):

        if not value:
            return value

        queryset = User.objects.filter(email__iexact=value)

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate(self, attrs):

        password = attrs.get("password", "")

        if not self.instance and not password:
            raise serializers.ValidationError({
                "password": "A password is required for new staff accounts."
            })

        if password:
            user = self.instance or User(
                username=attrs.get("username", ""),
                first_name=attrs.get("first_name", ""),
                last_name=attrs.get("last_name", ""),
                email=attrs.get("email", ""),
            )

            try:
                validate_password(password, user=user)
            except DjangoValidationError as error:
                raise serializers.ValidationError({
                    "password": list(error.messages)
                })

        return attrs

    def create(self, validated_data):

        profile_data = validated_data.pop("staff_profile", {})
        password = validated_data.pop("password")

        requester = self.context["request"].user
        approved = self.requester_role() == "admin"

        # A manager's new account stays inactive until an admin approves it.
        validated_data["is_active"] = approved and validated_data.get("is_active", True)

        user = User.objects.create_user(
            password=password,
            is_staff=False,
            is_superuser=False,
            **validated_data,
        )

        StaffProfile.objects.create(
            user=user,
            role=profile_data.get("role", "employee"),
            phone=profile_data.get("phone", ""),
            created_by=requester,
            approval_status="approved" if approved else "pending",
            approved_by=requester if approved else None,
            approved_at=timezone.now() if approved else None,
        )

        return user

    def update(self, instance, validated_data):

        profile_data = validated_data.pop("staff_profile", {})
        password = validated_data.pop("password", "")

        # Only admins activate or deactivate accounts; that includes
        # approving them, which has its own endpoint.
        if self.requester_role() != "admin" or instance.staff_profile.approval_status != "approved":
            validated_data.pop("is_active", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        instance.save()

        profile = instance.staff_profile

        for field, value in profile_data.items():
            setattr(profile, field, value)

        profile.save()

        return instance


# ==========================================
# STOCK LOG SERIALIZERS
# ==========================================

class StockLogSerializer(serializers.ModelSerializer):

    action_label = serializers.CharField(
        source="get_action_display",
        read_only=True,
    )

    class Meta:
        model = StockLog

        fields = [
            "id",
            "product",
            "product_name",
            "action",
            "action_label",
            "quantity_change",
            "stock_before",
            "stock_after",
            "note",
            "performed_by",
            "performed_by_name",
            "performed_by_role",
            "created_at",
        ]

        read_only_fields = fields


class StockAdjustmentSerializer(serializers.Serializer):

    # Positive to add stock, negative to remove it.
    change = serializers.IntegerField()

    note = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
    )

    def validate_change(self, value):

        if value == 0:
            raise serializers.ValidationError(
                "Enter a quantity to add or remove."
            )

        return value
