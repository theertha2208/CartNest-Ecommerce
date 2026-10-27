
from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Category,
    Product,
    Cart,
    CartItem,
    Order,
    OrderItem,
    AdminNotification,
    StaffProfile,
    StockLog,
)


# ==========================================
# CATEGORY ADMIN
# ==========================================

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "name",
        "slug",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
        "created_at",
    )

    search_fields = (
        "name",
        "description",
    )

    prepopulated_fields = {
        "slug": ("name",),
    }

    list_editable = (
        "is_active",
    )

    readonly_fields = (
        "created_at",
    )

    ordering = ("name",)


# ==========================================
# PRODUCT ADMIN
# ==========================================

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "sku",
        "product_image",
        "name",
        "category",
        "price",
        "original_price",
        "stock",
        "is_available",
        "is_featured",
        "created_at",
    )

    list_filter = (
        "category",
        "is_available",
        "is_featured",
        "created_at",
    )

    search_fields = (
        "sku",
        "name",
        "description",
        "category__name",
    )

    prepopulated_fields = {
        "slug": ("name",),
    }

    list_editable = (
        "price",
        "stock",
        "is_available",
        "is_featured",
    )

    readonly_fields = (
        "sku",
        "product_image",
        "created_at",
        "updated_at",
    )

    ordering = ("-created_at",)

    list_per_page = 20

    fieldsets = (
        (
            "Product Information",
            {
                "fields": (
                    "sku",
                    "name",
                    "slug",
                    "category",
                    "description",
                    "image",
                    "product_image",
                )
            },
        ),
        (
            "Pricing and Inventory",
            {
                "fields": (
                    "price",
                    "original_price",
                    "stock",
                    "unit",
                )
            },
        ),
        (
            "Product Visibility",
            {
                "fields": (
                    "is_available",
                    "is_featured",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(description="Image")
    def product_image(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="55" height="55" '
                'style="object-fit:cover;border-radius:8px;" />',
                obj.image.url,
            )

        return "No Image"


# ==========================================
# CART ITEM INLINE
# ==========================================

class CartItemInline(admin.TabularInline):

    model = CartItem

    extra = 0

    readonly_fields = (
        "product",
        "quantity",
        "added_at",
    )

    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


# ==========================================
# CART ADMIN
# ==========================================

@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "user",
        "total_items",
        "total_price",
        "created_at",
    )

    search_fields = (
        "user__username",
        "user__email",
    )

    readonly_fields = (
        "user",
        "created_at",
        "updated_at",
        "total_items",
        "total_price",
    )

    inlines = [
        CartItemInline,
    ]

    def has_add_permission(self, request):
        return False


# ==========================================
# ORDER ITEM INLINE
# ==========================================

class OrderItemInline(admin.TabularInline):

    model = OrderItem

    extra = 0

    readonly_fields = (
        "product",
        "product_name",
        "quantity",
        "price",
        "subtotal",
    )

    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


# ==========================================
# ORDER ADMIN
# ==========================================

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "user",
        "full_name",
        "total_amount",
        "status",
        "payment_method",
        "payment_status",
        "created_at",
    )

    list_filter = (
        "status",
        "payment_method",
        "payment_status",
        "created_at",
    )

    search_fields = (
        "user__username",
        "full_name",
        "phone",
        "city",
        "postal_code",
    )

    list_editable = (
        "status",
    )

    readonly_fields = (
        "user",
        "full_name",
        "phone",
        "address",
        "city",
        "state",
        "postal_code",
        "total_amount",
        "payment_method",
        "payment_status",
        "created_at",
        "updated_at",
    )

    inlines = [
        OrderItemInline,
    ]

    ordering = ("-created_at",)

    list_per_page = 20

    fieldsets = (
        (
            "Order Information",
            {
                "fields": (
                    "user",
                    "status",
                    "total_amount",
                )
            },
        ),
        (
            "Customer and Delivery Details",
            {
                "fields": (
                    "full_name",
                    "phone",
                    "address",
                    "city",
                    "state",
                    "postal_code",
                )
            },
        ),
        (
            "Payment Information",
            {
                "fields": (
                    "payment_method",
                    "payment_status",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


# ==========================================
# ADMIN SITE BRANDING
# ==========================================

admin.site.site_header = "CartNest Administration"

admin.site.site_title = "CartNest Admin"

admin.site.index_title = "Welcome to CartNest Management"


# ==========================================
# ADMIN NOTIFICATIONS
# ==========================================

@admin.register(AdminNotification)
class AdminNotificationAdmin(admin.ModelAdmin):

    list_display = ("title", "message", "is_read", "created_at")

    list_filter = ("is_read", "notification_type")

    search_fields = ("title", "message")

    readonly_fields = ("order", "created_at")


# ==========================================
# STORE STAFF AND STOCK ACTIVITY
# ==========================================

@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):

    list_display = ("user", "role", "phone", "created_by", "created_at")

    list_filter = ("role",)

    search_fields = ("user__username", "user__first_name", "user__last_name")


@admin.register(StockLog)
class StockLogAdmin(admin.ModelAdmin):

    list_display = (
        "created_at",
        "product_name",
        "action",
        "quantity_change",
        "stock_after",
        "performed_by_name",
        "performed_by_role",
    )

    list_filter = ("action", "performed_by_role")

    search_fields = ("product_name", "performed_by_name", "note")

    # The log is an audit trail, so it is read-only here.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
