from django.urls import path, include

from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenBlacklistView,
)

from .views import (
    RegisterView,
    LoginView,
    CurrentUserView,
    CustomerProfileView,
    DeliveryAddressViewSet,
    SetDefaultAddressView,
    CategoryViewSet,
    ProductViewSet,
    CartView,
    AddToCartView,
    UpdateCartItemView,
    RemoveCartItemView,
    ClearCartView,
    CheckoutView,
    MyOrdersView,
    MyOrderDetailView,
    CustomerCancelOrderView,
    AdminNotificationListView,
    AdminNotificationReadView,
    AdminNotificationReadAllView,
    AdminOrderListView,
    AdminOrderDetailView,
    AdminOrderStatusView,
    AdminDashboardStatsView,
    AdminCustomerListView,
    AdminCustomerDetailView,
    AdminAnalyticsView,
    AdminStoreSettingsView,
    WishlistView,
    RemoveWishlistItemView,
    ProductReviewsView,
    ProductReviewDetailView,
    ProductStockAdjustView,
    AdminStaffViewSet,
    AdminStockLogView,
    StockAlertsView,
    MyWorkView,
    PunchInView,
    PunchOutView,
    AssignmentBoardView,
    AdminOrderAssignView,
    AttendanceView,
)

router = DefaultRouter()

router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"addresses", DeliveryAddressViewSet, basename="delivery-address")
router.register(r"admin/staff", AdminStaffViewSet, basename="admin-staff")

urlpatterns = [
    # AUTHENTICATION
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", TokenBlacklistView.as_view(), name="logout"),
    path("auth/me/", CurrentUserView.as_view(), name="current-user"),

    # CUSTOMER PROFILE AND ADDRESSES
    path("profile/", CustomerProfileView.as_view(), name="customer-profile"),
    path("addresses/<int:address_id>/set-default/", SetDefaultAddressView.as_view(), name="set-default-address"),

    # WISHLIST
    path("wishlist/", WishlistView.as_view(), name="wishlist"),
    path("wishlist/<int:item_id>/", RemoveWishlistItemView.as_view(), name="wishlist-remove"),

    # PRODUCT RATINGS AND REVIEWS
    path("products/<int:product_id>/reviews/", ProductReviewsView.as_view(), name="product-reviews"),
    path("reviews/<int:review_id>/", ProductReviewDetailView.as_view(), name="product-review-detail"),

    # SHOPPING CART
    path("cart/", CartView.as_view(), name="cart"),
    path("cart/add/", AddToCartView.as_view(), name="cart-add"),
    path("cart/items/<int:item_id>/", UpdateCartItemView.as_view(), name="cart-update-item"),
    path("cart/items/<int:item_id>/remove/", RemoveCartItemView.as_view(), name="cart-remove-item"),
    path("cart/clear/", ClearCartView.as_view(), name="cart-clear"),

    # CUSTOMER CHECKOUT AND ORDERS
    path("checkout/", CheckoutView.as_view(), name="checkout"),
    path("orders/", MyOrdersView.as_view(), name="my-orders"),
    path("orders/<int:pk>/", MyOrderDetailView.as_view(), name="my-order-detail"),
    path("orders/<int:pk>/cancel/", CustomerCancelOrderView.as_view(), name="my-order-cancel"),

    # ADMIN DASHBOARD
    path("admin/dashboard/stats/", AdminDashboardStatsView.as_view(), name="admin-dashboard-stats"),

    # ADMIN CUSTOMER MANAGEMENT
    path("admin/customers/", AdminCustomerListView.as_view(), name="admin-customers"),
    path("admin/customers/<int:customer_id>/", AdminCustomerDetailView.as_view(), name="admin-customer-detail"),

    # ADMIN ORDER MANAGEMENT
    path("admin/orders/", AdminOrderListView.as_view(), name="admin-orders"),
    path("admin/orders/<int:pk>/", AdminOrderDetailView.as_view(), name="admin-order-detail"),
    path("admin/orders/<int:order_id>/status/", AdminOrderStatusView.as_view(), name="admin-order-status"),

    # ORDER ASSIGNMENT: EMPLOYEE SHIFTS, MANAGER/ADMIN BOARD AND REASSIGNMENT
    path("staff/my-work/", MyWorkView.as_view(), name="staff-my-work"),
    path("staff/punch-in/", PunchInView.as_view(), name="staff-punch-in"),
    path("staff/punch-out/", PunchOutView.as_view(), name="staff-punch-out"),
    path("admin/assignments/", AssignmentBoardView.as_view(), name="admin-assignments"),
    path("admin/orders/<int:order_id>/assign/", AdminOrderAssignView.as_view(), name="admin-order-assign"),
    path("attendance/", AttendanceView.as_view(), name="attendance"),

    # ADMIN ORDER NOTIFICATIONS
    path("admin/notifications/", AdminNotificationListView.as_view(), name="admin-notifications"),
    path("admin/notifications/read-all/", AdminNotificationReadAllView.as_view(), name="admin-notifications-read-all"),
    path("admin/notifications/<int:notification_id>/read/", AdminNotificationReadView.as_view(), name="admin-notification-read"),

    # STOCK MANAGEMENT (MANAGERS AND ADMINS) AND STOCK ACTIVITY LOG (ADMINS)
    path("products/<int:product_id>/adjust-stock/", ProductStockAdjustView.as_view(), name="product-adjust-stock"),
    path("admin/stock-logs/", AdminStockLogView.as_view(), name="admin-stock-logs"),
    path("admin/stock-alerts/", StockAlertsView.as_view(), name="admin-stock-alerts"),

    # ADMIN ANALYTICS AND STORE SETTINGS
    path("admin/analytics/", AdminAnalyticsView.as_view(), name="admin-analytics"),
    path("admin/settings/", AdminStoreSettingsView.as_view(), name="admin-settings"),

    # ROUTER: PRODUCTS, CATEGORIES, ADDRESSES
    path("", include(router.urls)),
]
