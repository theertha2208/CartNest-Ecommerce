
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model

from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.db.models import Q, F, Avg, Count, Sum
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

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
    ShiftRecord,
    StaffProfile,
    StockLog,
    get_user_role,
)

from .assignment import (
    DELIVERY,
    LANES,
    PACKING,
    active_order_for,
    assign_waiting_orders,
    available_profiles,
    lane_for_role,
    punch_in,
    punch_out,
    release_active_order,
    waiting_orders,
)

from .serializers import (
    RegisterSerializer,
    UserSerializer,
    CartNestTokenSerializer,
    CustomerProfileSerializer,
    DeliveryAddressSerializer,
    CategorySerializer,
    ProductSerializer,
    WishlistSerializer,
    AddToWishlistSerializer,
    ProductReviewSerializer,
    CreateProductReviewSerializer,
    UpdateProductReviewSerializer,
    CartSerializer,
    AddToCartSerializer,
    UpdateCartItemSerializer,
    OrderSerializer,
    CheckoutSerializer,
    CustomerOrderCancelSerializer,
    OrderStatusUpdateSerializer,
    StoreSettingsSerializer,
    AdminNotificationSerializer,
    StaffAccountSerializer,
    StockLogSerializer,
    StockAdjustmentSerializer,
    StaffOrderSerializer,
    OrderAssignSerializer,
    StaffApprovalSerializer,
)


STORE_STAFF_ROLES = ("admin", "manager", "employee", "delivery")


# ==========================================
# ADMIN OR READ-ONLY PERMISSION
# ==========================================

class IsAdminOrReadOnly(permissions.BasePermission):

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


# ==========================================
# ADMIN ONLY PERMISSION
# ==========================================

class IsAdminUser(permissions.BasePermission):

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


# ==========================================
# STORE STAFF PERMISSIONS (ADMIN, MANAGER, EMPLOYEE)
# ==========================================

class IsStoreStaff(permissions.BasePermission):

    def has_permission(self, request, view):
        return get_user_role(request.user) in STORE_STAFF_ROLES


class IsManagerOrAdmin(permissions.BasePermission):

    def has_permission(self, request, view):
        return get_user_role(request.user) in ("admin", "manager")


class IsManager(permissions.BasePermission):

    def has_permission(self, request, view):
        return get_user_role(request.user) == "manager"


class IsManagerOrReadOnly(permissions.BasePermission):

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        return get_user_role(request.user) in ("admin", "manager")


# ==========================================
# CUSTOMER ONLY PERMISSION (PURCHASING)
# ==========================================

class IsCustomer(permissions.BasePermission):

    message = (
        "Store staff accounts can browse the store "
        "but cannot purchase items."
    )

    def has_permission(self, request, view):
        return get_user_role(request.user) == "customer"


# ==========================================
# CUSTOMER REGISTRATION
# ==========================================

class RegisterView(generics.CreateAPIView):

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


# ==========================================
# JWT LOGIN
# ==========================================

class LoginView(TokenObtainPairView):

    serializer_class = CartNestTokenSerializer
    permission_classes = [permissions.AllowAny]


# ==========================================
# CURRENT USER
# ==========================================

class CurrentUserView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            UserSerializer(request.user).data
        )


# ==========================================
# CUSTOMER PROFILE
# ==========================================

class CustomerProfileView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get_profile(self, user):
        profile, created = CustomerProfile.objects.get_or_create(
            user=user
        )
        return profile

    def get(self, request):

        profile = self.get_profile(request.user)

        serializer = CustomerProfileSerializer(profile)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )

    def patch(self, request):

        with transaction.atomic():

            profile = self.get_profile(request.user)

            serializer = CustomerProfileSerializer(
                profile,
                data=request.data,
                partial=True
            )

            serializer.is_valid(raise_exception=True)
            serializer.save()

        return Response(
            CustomerProfileSerializer(profile).data,
            status=status.HTTP_200_OK
        )

    def put(self, request):

        return self.patch(request)


# ==========================================
# SAVED DELIVERY ADDRESSES
# ==========================================

class DeliveryAddressViewSet(viewsets.ModelViewSet):

    serializer_class = DeliveryAddressSerializer

    permission_classes = [
        permissions.IsAuthenticated
    ]

    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
    ]

    def get_queryset(self):

        return DeliveryAddress.objects.filter(
            user=self.request.user
        ).order_by(
            "-is_default",
            "-created_at"
        )

    def perform_create(self, serializer):

        with transaction.atomic():

            # Serialize address changes for this user.
            user = type(self.request.user).objects.select_for_update().get(
                pk=self.request.user.pk
            )

            existing_addresses = DeliveryAddress.objects.filter(
                user=user
            )

            first_address = not existing_addresses.exists()

            requested_default = serializer.validated_data.get(
                "is_default",
                False
            )

            make_default = first_address or requested_default

            if make_default:
                existing_addresses.update(
                    is_default=False
                )

            serializer.save(
                user=user,
                is_default=make_default
            )

    def perform_update(self, serializer):

        with transaction.atomic():

            user = type(self.request.user).objects.select_for_update().get(
                pk=self.request.user.pk
            )

            address = self.get_object()

            requested_default = serializer.validated_data.get(
                "is_default",
                address.is_default
            )

            if requested_default:

                DeliveryAddress.objects.filter(
                    user=user
                ).exclude(
                    pk=address.pk
                ).update(
                    is_default=False
                )

                serializer.save(is_default=True)

            elif address.is_default:

                # Keep an existing default until another
                # address is explicitly selected.
                serializer.save(is_default=True)

            else:

                serializer.save(is_default=False)

    def perform_destroy(self, instance):

        with transaction.atomic():

            user = type(self.request.user).objects.select_for_update().get(
                pk=self.request.user.pk
            )

            was_default = instance.is_default

            instance.delete()

            if was_default:

                next_address = DeliveryAddress.objects.filter(
                    user=user
                ).order_by(
                    "-created_at"
                ).first()

                if next_address:

                    next_address.is_default = True

                    next_address.save(
                        update_fields=[
                            "is_default",
                            "updated_at"
                        ]
                    )


# ==========================================
# SET DEFAULT DELIVERY ADDRESS
# ==========================================

class SetDefaultAddressView(APIView):

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def patch(self, request, address_id):

        with transaction.atomic():

            user = type(request.user).objects.select_for_update().get(
                pk=request.user.pk
            )

            address = get_object_or_404(
                DeliveryAddress,
                pk=address_id,
                user=user
            )

            DeliveryAddress.objects.filter(
                user=user
            ).exclude(
                pk=address.pk
            ).update(
                is_default=False
            )

            if not address.is_default:

                address.is_default = True

                address.save(
                    update_fields=[
                        "is_default",
                        "updated_at"
                    ]
                )

        return Response(
            DeliveryAddressSerializer(address).data,
            status=status.HTTP_200_OK
        )


# ==========================================
# CATEGORY API
# ==========================================

class CatalogPagination(PageNumberPagination):

    # 12 per page by default; the storefront and staff pages ask for the
    # whole catalogue with ?page_size=.
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 500


class CategoryViewSet(viewsets.ModelViewSet):

    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = CatalogPagination
    lookup_field = "pk"

    def get_queryset(self):

        queryset = Category.objects.all().order_by(
            "name"
        )

        if get_user_role(self.request.user) in STORE_STAFF_ROLES:
            return queryset

        return queryset.filter(is_active=True)


# ==========================================
# PRODUCT API
# ==========================================

class ProductViewSet(viewsets.ModelViewSet):

    # Managers and admins can add, edit and remove products.
    # Employees (and the public) can only read them.
    serializer_class = ProductSerializer
    permission_classes = [IsManagerOrReadOnly]
    pagination_class = CatalogPagination
    lookup_field = "pk"

    def get_queryset(self):

        queryset = Product.objects.select_related(
            "category"
        ).all().order_by("-created_at")

        user = self.request.user

        if get_user_role(user) in STORE_STAFF_ROLES:
            # Staff see every product and can find one by SKU, name or category.
            sku = self.request.query_params.get("sku", "").strip()

            if sku:
                queryset = queryset.filter(sku__iexact=sku)

            search = self.request.query_params.get("search", "").strip()

            if search:
                queryset = queryset.filter(
                    Q(sku__icontains=search)
                    | Q(name__icontains=search)
                    | Q(category__name__icontains=search)
                )

            return queryset

        queryset = queryset.filter(
            is_available=True,
            category__is_active=True,
        )

        search = self.request.query_params.get(
            "search", ""
        ).strip()

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(category__name__icontains=search)
            )

        category = self.request.query_params.get(
            "category", ""
        ).strip()

        if category:
            queryset = queryset.filter(
                category_id=category
            )

        featured = self.request.query_params.get(
            "featured", ""
        ).strip().lower()

        if featured == "true":
            queryset = queryset.filter(
                is_featured=True
            )

        return queryset

    def perform_create(self, serializer):

        with transaction.atomic():
            product = serializer.save()

            log_stock_activity(
                self.request.user,
                product,
                "product_created",
                stock_before=0,
                stock_after=product.stock,
            )

    def perform_update(self, serializer):

        with transaction.atomic():
            stock_before = Product.objects.select_for_update().get(
                pk=serializer.instance.pk
            ).stock

            product = serializer.save()

            if product.stock > stock_before:
                action = "stock_added"
            elif product.stock < stock_before:
                action = "stock_removed"
            else:
                action = "product_updated"

            log_stock_activity(
                self.request.user,
                product,
                action,
                stock_before=stock_before,
                stock_after=product.stock,
                note="Edited from the product form",
            )

    def destroy(self, request, *args, **kwargs):

        product = self.get_object()

        try:
            with transaction.atomic():
                log_stock_activity(
                    request.user,
                    product,
                    "product_deleted",
                    stock_before=product.stock,
                    stock_after=0,
                )

                product.delete()

        except ProtectedError:
            return Response(
                {
                    "detail":
                    "This product appears in past orders and cannot "
                    "be deleted. Mark it as unavailable instead."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


# ==========================================
# STOCK ACTIVITY HELPER
# ==========================================

def log_stock_activity(user, product, action, stock_before, stock_after, note=""):

    StockLog.objects.create(
        product=product,
        product_name=product.name,
        action=action,
        quantity_change=stock_after - stock_before,
        stock_before=stock_before,
        stock_after=stock_after,
        note=note,
        performed_by=user,
        performed_by_name=user.get_full_name() or user.username,
        performed_by_role=get_user_role(user) or "",
    )


# ==========================================
# MANAGER / ADMIN - ADD OR REMOVE STOCK
# ==========================================

class ProductStockAdjustView(APIView):

    permission_classes = [IsManagerOrAdmin]

    def post(self, request, product_id):

        serializer = StockAdjustmentSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        change = serializer.validated_data["change"]
        note = serializer.validated_data["note"]

        with transaction.atomic():

            product = get_object_or_404(
                Product.objects.select_for_update(),
                pk=product_id,
            )

            stock_before = product.stock
            stock_after = stock_before + change

            if stock_after < 0:
                return Response(
                    {
                        "detail":
                        f"Only {stock_before} units are in stock, "
                        f"so {abs(change)} cannot be removed."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            product.stock = stock_after
            product.save(update_fields=["stock", "updated_at"])

            log_stock_activity(
                request.user,
                product,
                "stock_added" if change > 0 else "stock_removed",
                stock_before=stock_before,
                stock_after=stock_after,
                note=note,
            )

        product = Product.objects.select_related(
            "category"
        ).get(pk=product.pk)

        return Response(
            ProductSerializer(
                product,
                context={"request": request}
            ).data,
            status=status.HTTP_200_OK
        )


# ==========================================
# CART HELPERS
# ==========================================

def get_user_cart(user):

    cart, created = Cart.objects.get_or_create(
        user=user
    )

    return cart


def get_cart_response(cart):

    cart = Cart.objects.prefetch_related(
        "items__product"
    ).get(pk=cart.pk)

    return CartSerializer(cart).data


# ==========================================
# VIEW CART
# ==========================================

class CartView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):

        cart = get_user_cart(request.user)

        return Response(
            get_cart_response(cart),
            status=status.HTTP_200_OK
        )


# ==========================================
# ADD TO CART
# ==========================================

class AddToCartView(APIView):

    permission_classes = [IsCustomer]

    def post(self, request):

        serializer = AddToCartSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        product_id = serializer.validated_data[
            "product_id"
        ]

        quantity = serializer.validated_data[
            "quantity"
        ]

        with transaction.atomic():

            cart = get_user_cart(request.user)

            product = get_object_or_404(
                Product.objects.select_for_update().select_related(
                    "category"
                ),
                pk=product_id,
            )

            if (
                not product.is_available
                or not product.category.is_active
            ):
                return Response(
                    {
                        "detail": "This product is not available."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            cart_item, created = CartItem.objects.get_or_create(
                cart=cart,
                product=product,
                defaults={"quantity": quantity},
            )

            new_quantity = (
                quantity
                if created
                else cart_item.quantity + quantity
            )

            if new_quantity > product.stock:

                if created:
                    cart_item.delete()

                return Response(
                    {
                        "detail":
                        f"Only {product.stock} items are available."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not created:
                cart_item.quantity = new_quantity
                cart_item.save(
                    update_fields=["quantity"]
                )

            cart.save(update_fields=["updated_at"])

        return Response(
            get_cart_response(cart),
            status=status.HTTP_200_OK
        )


# ==========================================
# UPDATE CART ITEM QUANTITY
# ==========================================

class UpdateCartItemView(APIView):

    permission_classes = [IsCustomer]

    def patch(self, request, item_id):

        serializer = UpdateCartItemSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        quantity = serializer.validated_data[
            "quantity"
        ]

        with transaction.atomic():

            cart = get_user_cart(request.user)

            cart_item = get_object_or_404(
                CartItem,
                pk=item_id,
                cart=cart,
            )

            product = Product.objects.select_for_update().select_related(
                "category"
            ).get(
                pk=cart_item.product_id
            )

            if (
                not product.is_available
                or not product.category.is_active
            ):
                return Response(
                    {
                        "detail": "This product is not available."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if quantity > product.stock:
                return Response(
                    {
                        "detail":
                        f"Only {product.stock} items are available."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            cart_item.quantity = quantity
            cart_item.save(
                update_fields=["quantity"]
            )

            cart.save(update_fields=["updated_at"])

        return Response(
            get_cart_response(cart)
        )


# ==========================================
# REMOVE CART ITEM
# ==========================================

class RemoveCartItemView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, item_id):

        cart = get_user_cart(request.user)

        cart_item = get_object_or_404(
            CartItem,
            pk=item_id,
            cart=cart,
        )

        cart_item.delete()

        cart.save(update_fields=["updated_at"])

        return Response(
            get_cart_response(cart)
        )


# ==========================================
# CLEAR CART
# ==========================================

class ClearCartView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):

        cart = get_user_cart(request.user)

        cart.items.all().delete()

        cart.save(update_fields=["updated_at"])

        return Response(
            get_cart_response(cart)
        )


# ==========================================
# CHECKOUT / PLACE ORDER
# ==========================================

class CheckoutView(APIView):

    permission_classes = [IsCustomer]

    def post(self, request):

        serializer = CheckoutSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        delivery_data = serializer.validated_data

        with transaction.atomic():

            cart = get_user_cart(request.user)

            cart_items = list(
                CartItem.objects.filter(
                    cart=cart
                ).select_related(
                    "product__category"
                ).order_by("product_id")
            )

            if not cart_items:
                return Response(
                    {
                        "detail": "Your shopping bag is empty."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Lock products in a consistent order.
            product_ids = [
                item.product_id
                for item in cart_items
            ]

            products = {
                product.id: product
                for product in Product.objects.select_for_update().select_related(
                    "category"
                ).filter(
                    id__in=product_ids
                ).order_by("id")
            }

            total_amount = Decimal("0.00")

            for item in cart_items:

                product = products.get(
                    item.product_id
                )

                if product is None:
                    return Response(
                        {
                            "detail":
                            "A product in your cart no longer exists."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if (
                    not product.is_available
                    or not product.category.is_active
                ):
                    return Response(
                        {
                            "detail":
                            f"{product.name} is no longer available."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if item.quantity > product.stock:
                    return Response(
                        {
                            "detail":
                            f"Only {product.stock} units of "
                            f"{product.name} are available."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                total_amount += (
                    product.price * item.quantity
                )

            # Automatically confirm the order.
            # COD payment remains pending until delivery.

            order = Order.objects.create(
                user=request.user,
                full_name=delivery_data["full_name"],
                phone=delivery_data["phone"],
                address=delivery_data["address"],
                city=delivery_data["city"],
                state=delivery_data["state"],
                postal_code=delivery_data["postal_code"],
                total_amount=total_amount,
                status="confirmed",
                payment_method="cod",
                payment_status="pending",
            )

            # Save purchased products and prices.
            order_items = [
                OrderItem(
                    order=order,
                    product=products[item.product_id],
                    product_name=products[
                        item.product_id
                    ].name,
                    quantity=item.quantity,
                    price=products[
                        item.product_id
                    ].price,
                )
                for item in cart_items
            ]

            OrderItem.objects.bulk_create(
                order_items
            )

            # Alert the admins. Rolls back with the order if checkout fails.
            item_count = sum(
                item.quantity
                for item in cart_items
            )

            AdminNotification.objects.create(
                notification_type="new_order",
                order=order,
                title=f"New order #CN{order.id:06d}",
                message=(
                    f"{order.full_name} ordered {item_count} "
                    f"{'item' if item_count == 1 else 'items'} "
                    f"worth ₹{total_amount:,.2f}"
                ),
            )

            # Reduce stock conditionally.
            for item in cart_items:

                updated = Product.objects.filter(
                    pk=item.product_id,
                    stock__gte=item.quantity,
                    is_available=True,
                    category__is_active=True,
                ).update(
                    stock=F("stock") - item.quantity
                )

                if updated != 1:
                    # Roll back the entire checkout transaction.
                    raise ValidationError({
                        "detail":
                        "Stock changed during checkout. "
                        "Please try again."
                    })

            # Empty the cart after a successful order.
            CartItem.objects.filter(
                cart=cart
            ).delete()

            cart.save(
                update_fields=["updated_at"]
            )

        # The new order joins the queue; a free employee picks it up now.
        assign_waiting_orders()

        order = Order.objects.select_related(
            "user"
        ).prefetch_related(
            "items__product"
        ).get(pk=order.pk)

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED
        )


# ==========================================
# CUSTOMER ORDER HISTORY
# ==========================================

class MyOrdersView(generics.ListAPIView):

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):

        return Order.objects.filter(
            user=self.request.user
        ).select_related(
            "user"
        ).prefetch_related(
            "items__product"
        ).order_by("-created_at")


# ==========================================
# CUSTOMER ORDER DETAILS
# ==========================================

class MyOrderDetailView(generics.RetrieveAPIView):

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    lookup_field = "pk"

    def get_queryset(self):

        return Order.objects.filter(
            user=self.request.user
        ).select_related(
            "user"
        ).prefetch_related(
            "items__product"
        )


# ==========================================
# CUSTOMER - CANCEL AN ORDER BEFORE SHIPPING
# ==========================================

class CustomerCancelOrderView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):

        serializer = CustomerOrderCancelSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get(
            "reason", ""
        )

        with transaction.atomic():

            # Customers can only cancel their own orders.
            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=pk,
                user=request.user,
            )

            if order.status == "cancelled":
                return Response(
                    {
                        "detail":
                        "This order has already been cancelled."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not order.can_be_cancelled_by_customer:
                return Response(
                    {
                        "detail":
                        "This order has already been "
                        f"{order.get_status_display().lower()} "
                        "and can no longer be cancelled."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Return the reserved stock.
            order_items = list(
                OrderItem.objects.filter(
                    order=order
                ).order_by("product_id")
            )

            for item in order_items:

                Product.objects.filter(
                    pk=item.product_id
                ).update(
                    stock=F("stock") + item.quantity
                )

            order.status = "cancelled"

            order.cancellation_reason = (
                f"Cancelled by customer: {reason}"
                if reason
                else "Cancelled by customer."
            )

            order.cancelled_at = timezone.now()

            order.save(
                update_fields=[
                    "status",
                    "cancellation_reason",
                    "cancelled_at",
                    "updated_at",
                ]
            )

        # A cancelled order frees its employee for the next one.
        assign_waiting_orders()

        order = Order.objects.select_related(
            "user"
        ).prefetch_related(
            "items__product"
        ).get(pk=order.pk)

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_200_OK
        )


# ==========================================
# ADMIN - ORDER NOTIFICATIONS
# ==========================================

class AdminNotificationListView(APIView):

    # Employees get orders through assignment instead.
    permission_classes = [IsManagerOrAdmin]

    def get(self, request):

        notifications = AdminNotification.objects.select_related(
            "order"
        )

        latest = notifications[:20]

        return Response(
            {
                "unread_count": notifications.filter(
                    is_read=False
                ).count(),
                "results": AdminNotificationSerializer(
                    latest,
                    many=True
                ).data,
            },
            status=status.HTTP_200_OK
        )


class AdminNotificationReadView(APIView):

    # Employees get orders through assignment instead.
    permission_classes = [IsManagerOrAdmin]

    def post(self, request, notification_id):

        updated = AdminNotification.objects.filter(
            pk=notification_id
        ).update(is_read=True)

        if not updated:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminNotificationReadAllView(APIView):

    # Employees get orders through assignment instead.
    permission_classes = [IsManagerOrAdmin]

    def post(self, request):

        AdminNotification.objects.filter(
            is_read=False
        ).update(is_read=True)

        return Response(status=status.HTTP_204_NO_CONTENT)


# ==========================================
# ADMIN - VIEW ALL ORDERS
# ==========================================

def staff_orders(user):
    # Admins and managers see every order. Employees see the orders they
    # packed; delivery staff the orders they deliver.
    queryset = Order.objects.select_related(
        "user",
        "assigned_to",
        "delivery_person",
    ).prefetch_related(
        "items__product"
    )

    role = get_user_role(user)

    if role == "employee":
        queryset = queryset.filter(assigned_to=user)
    elif role == "delivery":
        queryset = queryset.filter(delivery_person=user)

    return queryset


class StaffOrderPagination(PageNumberPagination):

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminOrderListView(generics.ListAPIView):

    serializer_class = StaffOrderSerializer
    permission_classes = [IsStoreStaff]
    pagination_class = StaffOrderPagination

    def get_queryset(self):

        queryset = staff_orders(self.request.user).order_by("-created_at")

        # One status, or several separated by commas (e.g. "pending,confirmed").
        statuses = [
            value.strip()
            for value in self.request.query_params.get("status", "").split(",")
            if value.strip()
        ]

        if statuses:
            queryset = queryset.filter(status__in=statuses)

        search = self.request.query_params.get("search", "").strip()

        if search:
            # "#CN000012", "CN12" and "12" all find order 12.
            number = search.upper().lstrip("#").removeprefix("CN")

            matches = (
                Q(full_name__icontains=search)
                | Q(user__username__icontains=search)
                | Q(phone__icontains=search)
                | Q(city__icontains=search)
            )

            if number.isdigit():
                matches |= Q(pk=int(number))

            queryset = queryset.filter(matches)

        return queryset


# ==========================================
# ADMIN - VIEW ORDER DETAILS
# ==========================================

class AdminOrderDetailView(generics.RetrieveAPIView):

    serializer_class = StaffOrderSerializer
    permission_classes = [IsStoreStaff]

    lookup_field = "pk"

    def get_queryset(self):
        return staff_orders(self.request.user)


# ==========================================
# ADMIN - UPDATE ORDER STATUS
# ==========================================

def status_change_denied(user, order, new_status):
    """Why this user may not make this change, or None if they may.

    Employees pack their own order; delivery staff ship (on pickup) and
    deliver their own order; managers may cancel; admins only view.
    """

    role = get_user_role(user)

    if role == "admin":
        return "Admins can view orders but not change their status."

    if role == "manager":
        if new_status != "cancelled":
            return "Managers monitor orders; store staff and delivery staff update them."
        return None

    if role == "employee":
        if order.assigned_to_id != user.id:
            return "This order is not assigned to you."
        if new_status != "packed":
            return "Staff can only mark their order as packed."
        return None

    if role == "delivery":
        if order.delivery_person_id != user.id:
            return "This delivery is not assigned to you."
        if new_status not in ("shipped", "delivered"):
            return "Delivery staff can only mark orders as shipped or delivered."
        return None

    return "You cannot change order status."


class AdminOrderStatusView(APIView):

    permission_classes = [IsStoreStaff]

    def patch(self, request, order_id):

        with transaction.atomic():

            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=order_id,
            )

            serializer = OrderStatusUpdateSerializer(
                order,
                data=request.data,
                partial=True,
            )

            serializer.is_valid(
                raise_exception=True
            )

            new_status = serializer.validated_data.get(
                "status"
            )

            if not new_status:
                return Response(
                    {
                        "detail":
                        "Please provide a new order status."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            denied = status_change_denied(request.user, order, new_status)

            if denied:
                return Response(
                    {"detail": denied},
                    status=status.HTTP_403_FORBIDDEN
                )

            # If the admin cancels an order,
            # record the reason and return stock.

            if new_status == "cancelled":

                cancellation_reason = (
                    serializer.validated_data[
                        "cancellation_reason"
                    ]
                )

                order_items = list(
                    OrderItem.objects.filter(
                        order=order
                    ).order_by("product_id")
                )

                for item in order_items:

                    Product.objects.filter(
                        pk=item.product_id
                    ).update(
                        stock=F("stock") + item.quantity
                    )

                order.cancellation_reason = (
                    cancellation_reason
                )

                order.cancelled_at = timezone.now()

            order.status = new_status

            # Record when each tracking step happened, for the customer timeline.
            tracking_field = {
                "packed": "packed_at",
                "shipped": "shipped_at",
                "delivered": "delivered_at",
            }.get(new_status)

            if tracking_field:
                setattr(order, tracking_field, timezone.now())

            # COD payment is marked paid on delivery.
            if (
                new_status == "delivered"
                and order.payment_method == "cod"
            ):
                order.payment_status = "paid"

            order.save(
                update_fields=[
                    "status",
                    "payment_status",
                    "cancellation_reason",
                    "cancelled_at",
                    "packed_at",
                    "shipped_at",
                    "delivered_at",
                    "updated_at",
                ]
            )

        # Packing (or cancelling) frees the employee for the next order.
        assign_waiting_orders()

        order = staff_orders(request.user).get(pk=order.pk)

        return Response(
            StaffOrderSerializer(order).data,
            status=status.HTTP_200_OK
        )


# ==========================================
# ADMIN DASHBOARD STATISTICS
# ==========================================

class AdminDashboardStatsView(APIView):

    permission_classes = [IsStoreStaff]

    def get(self, request):
        paid_orders = Order.objects.filter(
            payment_status="paid"
        ).exclude(status="cancelled")

        total_revenue = paid_orders.aggregate(
            total=Sum("total_amount")
        )["total"] or Decimal("0.00")

        # Group currently paid, non-cancelled orders by the date they
        # were placed. This is not the date the payment was collected.
        today = timezone.localdate()
        first_day = today - timedelta(days=6)

        daily_totals = (
            paid_orders.filter(created_at__date__gte=first_day,
                               created_at__date__lte=today)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(revenue=Sum("total_amount"), orders=Count("id"))
            .order_by("day")
        )
        daily_lookup = {entry["day"]: entry for entry in daily_totals}
        sales_last_7_days = []

        for offset in range(7):
            day = first_day + timedelta(days=offset)
            entry = daily_lookup.get(day, {})
            sales_last_7_days.append({
                "date": day.isoformat(),
                "revenue": str(entry.get("revenue") or Decimal("0.00")),
                "orders": entry.get("orders", 0),
            })

        User = get_user_model()

        return Response({
            "total_revenue": str(total_revenue),
            "total_orders": Order.objects.count(),
            "total_products": Product.objects.count(),
            "total_customers": customer_accounts().count(),
            "sales_last_7_days": sales_last_7_days,
        }, status=status.HTTP_200_OK)


# ==========================================
# ADMIN - CUSTOMER MANAGEMENT
# ==========================================

def customer_accounts():
    # Customers are accounts that are neither admins nor store staff.
    return get_user_model().objects.filter(
        is_staff=False,
        staff_profile__isnull=True,
    )


class AdminCustomerListView(APIView):
    """Read-only customer directory, restricted to staff administrators."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        customers = customer_accounts().order_by("-date_joined", "-pk")

        search = request.query_params.get("search", "").strip()
        if search:
            customers = customers.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        # One aggregate query, rather than a database query for each customer.
        customer_ids = list(customers.values_list("pk", flat=True))
        order_summary = Order.objects.filter(user_id__in=customer_ids).values(
            "user_id"
        ).annotate(
            total_orders=Count("id"),
            total_spent=Sum(
                "total_amount",
                filter=Q(payment_status="paid") & ~Q(status="cancelled"),
            ),
        )
        summary_by_user = {row["user_id"]: row for row in order_summary}

        results = []
        for customer in customers:
            summary = summary_by_user.get(customer.pk, {})
            results.append({
                "id": customer.pk,
                "username": customer.username,
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "full_name": customer.get_full_name() or customer.username,
                "email": customer.email,
                "date_joined": customer.date_joined.isoformat(),
                "is_active": customer.is_active,
                "total_orders": summary.get("total_orders", 0),
                "total_spent": str(summary.get("total_spent") or Decimal("0.00")),
            })

        return Response({
            "count": len(results),
            "customers": results,
        }, status=status.HTTP_200_OK)


class AdminCustomerDetailView(APIView):
    """Customer profile and order history for administrators only."""

    permission_classes = [IsAdminUser]

    def get(self, request, customer_id):
        customer = get_object_or_404(
            customer_accounts(), pk=customer_id
        )
        orders = Order.objects.filter(user=customer).select_related(
            "user"
        ).prefetch_related("items__product").order_by("-created_at")

        paid_total = orders.filter(payment_status="paid").exclude(
            status="cancelled"
        ).aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")

        return Response({
            "customer": {
                "id": customer.pk,
                "username": customer.username,
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "full_name": customer.get_full_name() or customer.username,
                "email": customer.email,
                "date_joined": customer.date_joined.isoformat(),
                "is_active": customer.is_active,
                "total_orders": orders.count(),
                "total_spent": str(paid_total),
            },
            "orders": OrderSerializer(orders, many=True).data,
        }, status=status.HTTP_200_OK)


# ==========================================
# ==========================================
# WISHLIST - VIEW AND ADD PRODUCTS
# ==========================================

class WishlistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wishlist_items = Wishlist.objects.filter(
            user=request.user
        ).select_related("product__category").order_by("-created_at")

        serializer = WishlistSerializer(
            wishlist_items, many=True, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AddToWishlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product_id = serializer.validated_data["product_id"]
        product = get_object_or_404(Product, pk=product_id)

        wishlist_item, created = Wishlist.objects.get_or_create(
            user=request.user, product=product
        )

        response_serializer = WishlistSerializer(
            wishlist_item, context={"request": request}
        )
        return Response(
            {
                "detail": (
                    "Product added to wishlist."
                    if created else "Product is already in your wishlist."
                ),
                "item": response_serializer.data,
            },
            status=(
                status.HTTP_201_CREATED if created else status.HTTP_200_OK
            ),
        )


# ==========================================
# WISHLIST - REMOVE SAVED PRODUCT
# ==========================================

class RemoveWishlistItemView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, item_id):
        wishlist_item = get_object_or_404(
            Wishlist, pk=item_id, user=request.user
        )
        wishlist_item.delete()
        return Response(
            {"detail": "Product removed from wishlist."},
            status=status.HTTP_200_OK,
        )


# ==========================================
# PRODUCT REVIEWS - LIST AND CREATE
# ==========================================

class ProductReviewsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        reviews = ProductReview.objects.filter(
            product=product
        ).select_related("user", "product").order_by("-created_at")

        summary = reviews.aggregate(
            average_rating=Avg("rating"),
            review_count=Count("id"),
        )
        serializer = ProductReviewSerializer(
            reviews, many=True, context={"request": request}
        )
        return Response({
            "product_id": product.id,
            "average_rating": round(summary["average_rating"] or 0, 2),
            "review_count": summary["review_count"],
            "reviews": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request, product_id):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = CreateProductReviewSerializer(
            data={**request.data, "product_id": product_id},
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        return Response(
            ProductReviewSerializer(review, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


# ==========================================
# PRODUCT REVIEWS - UPDATE AND DELETE
# ==========================================

class ProductReviewDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, review_id):
        review = get_object_or_404(
            ProductReview, pk=review_id, user=request.user
        )
        serializer = UpdateProductReviewSerializer(
            review, data=request.data, partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            ProductReviewSerializer(review, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    def put(self, request, review_id):
        review = get_object_or_404(
            ProductReview, pk=review_id, user=request.user
        )
        serializer = UpdateProductReviewSerializer(
            review, data=request.data, context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            ProductReviewSerializer(review, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request, review_id):
        review = get_object_or_404(
            ProductReview, pk=review_id, user=request.user
        )
        review.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ==========================================
# ADMIN - ANALYTICS
# ==========================================

class AdminAnalyticsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        paid = Order.objects.filter(payment_status="paid").exclude(status="cancelled")
        today = timezone.localdate()
        start = today.replace(day=1)
        monthly = (paid.filter(created_at__date__gte=start)
                   .annotate(day=TruncDate("created_at"))
                   .values("day").annotate(revenue=Sum("total_amount"), orders=Count("id")).order_by("day"))
        top_products = (OrderItem.objects.filter(order__payment_status="paid")
                        .exclude(order__status="cancelled")
                        .values("product_id", "product_name")
                        .annotate(units_sold=Sum("quantity"), revenue=Sum(F("quantity") * F("price")))
                        .order_by("-units_sold", "product_name")[:10])
        by_status = Order.objects.values("status").annotate(count=Count("id")).order_by("status")
        return Response({
            "paid_revenue": str(paid.aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")),
            "paid_orders": paid.count(),
            "monthly_daily_sales": [{"date": row["day"].isoformat(), "revenue": str(row["revenue"]), "orders": row["orders"]} for row in monthly],
            "top_products": [{"product_id": row["product_id"], "name": row["product_name"], "units_sold": row["units_sold"], "revenue": str(row["revenue"] or 0)} for row in top_products],
            "order_statuses": list(by_status),
        })


# ==========================================
# ADMIN - STORE SETTINGS
# ==========================================

class AdminStoreSettingsView(APIView):
    permission_classes = [IsAdminUser]

    def get_settings(self):
        settings_obj, _ = StoreSettings.objects.get_or_create(pk=1)
        return settings_obj

    def get(self, request):
        return Response(StoreSettingsSerializer(self.get_settings()).data)

    def patch(self, request):
        settings_obj = self.get_settings()
        serializer = StoreSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ==========================================
# ADMIN - STAFF MANAGEMENT (EMPLOYEES AND MANAGERS)
# ==========================================

class AdminStaffViewSet(viewsets.ModelViewSet):

    # Admins manage every staff account. Managers add and edit staff and
    # delivery staff; their new accounts wait for an admin's approval.
    serializer_class = StaffAccountSerializer
    permission_classes = [IsManagerOrAdmin]
    pagination_class = None

    http_method_names = [
        "get",
        "post",
        "patch",
        "delete",
        "head",
        "options",
    ]

    def get_queryset(self):

        queryset = get_user_model().objects.filter(
            is_staff=False,
            staff_profile__isnull=False,
        ).select_related(
            "staff_profile__created_by",
            "staff_profile__approved_by",
        ).order_by("staff_profile__role", "username")

        if get_user_role(self.request.user) == "manager":
            queryset = queryset.filter(staff_profile__role__in=["employee", "delivery"])

        role = self.request.query_params.get("role", "").strip()

        if role:
            queryset = queryset.filter(staff_profile__role=role)

        approval = self.request.query_params.get("approval", "").strip()

        if approval:
            queryset = queryset.filter(staff_profile__approval_status=approval)

        search = self.request.query_params.get("search", "").strip()

        if search:
            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):

        with transaction.atomic():
            serializer.save()

    def perform_update(self, serializer):

        old_role = serializer.instance.staff_profile.role

        with transaction.atomic():
            staff_user = serializer.save()

        # A deactivated account, or one whose role changed, ends its shift
        # and hands back any order it has not started.
        profile = staff_user.staff_profile

        if profile.is_punched_in and (
            not staff_user.is_active or profile.role != old_role
        ):
            punch_out(profile)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):

        if get_user_role(request.user) != "admin":
            return Response(
                {"detail": "Only an admin can approve staff accounts."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = StaffApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        approve = serializer.validated_data["decision"] == "approve"

        with transaction.atomic():
            staff_user = self.get_object()
            profile = staff_user.staff_profile

            profile.approval_status = "approved" if approve else "rejected"
            profile.approved_by = request.user
            profile.approved_at = timezone.now()
            profile.save(update_fields=["approval_status", "approved_by", "approved_at", "updated_at"])

            staff_user.is_active = approve
            staff_user.save(update_fields=["is_active"])

        if not approve and profile.is_punched_in:
            punch_out(profile)

        return Response(
            StaffAccountSerializer(staff_user, context={"request": request}).data,
            status=status.HTTP_200_OK
        )

    def destroy(self, request, *args, **kwargs):

        if get_user_role(request.user) != "admin":
            return Response(
                {"detail": "Only an admin can delete staff accounts."},
                status=status.HTTP_403_FORBIDDEN
            )

        staff_user = self.get_object()

        try:
            release_active_order(staff_user, PACKING)
            release_active_order(staff_user, DELIVERY)
            staff_user.delete()
        except ProtectedError:
            return Response(
                {
                    "detail":
                    "This account has order history and cannot be "
                    "deleted. Deactivate it instead."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        assign_waiting_orders()

        return Response(status=status.HTTP_204_NO_CONTENT)


# ==========================================
# ADMIN - STOCK ACTIVITY LOG
# ==========================================

class AdminStockLogView(APIView):

    permission_classes = [IsAdminUser]

    def get(self, request):

        logs = StockLog.objects.all()

        action = request.query_params.get("action", "").strip()

        if action:
            logs = logs.filter(action=action)

        role = request.query_params.get("role", "").strip()

        if role:
            logs = logs.filter(performed_by_role=role)

        search = request.query_params.get("search", "").strip()

        if search:
            logs = logs.filter(
                Q(product_name__icontains=search)
                | Q(performed_by_name__icontains=search)
                | Q(performed_by__username__icontains=search)
                | Q(note__icontains=search)
            )

        summary = logs.aggregate(
            total=Count("id"),
            units_added=Sum(
                "quantity_change",
                filter=Q(quantity_change__gt=0),
            ),
            units_removed=Sum(
                "quantity_change",
                filter=Q(quantity_change__lt=0),
            ),
        )

        return Response({
            "count": summary["total"],
            "units_added": summary["units_added"] or 0,
            "units_removed": abs(summary["units_removed"] or 0),
            "results": StockLogSerializer(logs[:300], many=True).data,
        }, status=status.HTTP_200_OK)


# ==========================================
# STAFF - OUT OF STOCK AND LOW STOCK ALERTS
# ==========================================

# Products with 1 to LOW_STOCK_THRESHOLD units left count as low stock.
LOW_STOCK_THRESHOLD = 5


class StockAlertsView(APIView):

    permission_classes = [IsStoreStaff]

    def get(self, request):

        products = Product.objects.select_related(
            "category"
        ).order_by("stock", "name")

        out_of_stock = products.filter(stock=0)

        low_stock = products.filter(
            stock__gt=0,
            stock__lte=LOW_STOCK_THRESHOLD,
        )

        context = {"request": request}

        return Response({
            "low_stock_threshold": LOW_STOCK_THRESHOLD,
            "out_of_stock_count": out_of_stock.count(),
            "low_stock_count": low_stock.count(),
            "out_of_stock": ProductSerializer(out_of_stock, many=True, context=context).data,
            "low_stock": ProductSerializer(low_stock, many=True, context=context).data,
        }, status=status.HTTP_200_OK)


# ==========================================
# STAFF AND DELIVERY PARTNERS - SHIFT AND CURRENT ORDER
# ==========================================

class IsShiftWorker(permissions.BasePermission):

    # Employees (packing) and delivery staff punch in and out.
    def has_permission(self, request, view):
        return get_user_role(request.user) in ("employee", "delivery")


def my_work_response(request):

    profile = request.user.staff_profile
    lane = lane_for_role(profile.role)
    current = active_order_for(request.user, lane)

    if current is not None:
        current = staff_orders(request.user).get(pk=current.pk)

    # Orders this person finished today: packed, or delivered.
    finished_field = "packed_at" if lane is PACKING else "delivered_at"

    return Response({
        "role": profile.role,
        "is_punched_in": profile.is_punched_in,
        "punched_in_at": profile.punched_in_at,
        "punched_out_at": profile.punched_out_at,
        "current_order": StaffOrderSerializer(current).data if current else None,
        "waiting_orders": waiting_orders(lane).count(),
        "completed_today": Order.objects.filter(
            **{lane.person_field: request.user},
            **{f"{finished_field}__date": timezone.localdate()},
        ).count(),
    }, status=status.HTTP_200_OK)


class MyWorkView(APIView):

    permission_classes = [IsShiftWorker]

    def get(self, request):
        return my_work_response(request)


class PunchInView(APIView):

    permission_classes = [IsShiftWorker]

    def post(self, request):

        profile = request.user.staff_profile

        if not profile.is_punched_in:
            punch_in(profile)

        return my_work_response(request)


class PunchOutView(APIView):

    permission_classes = [IsShiftWorker]

    def post(self, request):

        profile = request.user.staff_profile

        if profile.is_punched_in:
            punch_out(profile)

        return my_work_response(request)


# ==========================================
# MANAGER / ADMIN - ASSIGNMENT BOARD, MANAGER - REASSIGNMENT
# ==========================================

def order_summary(order):

    return {
        "id": order.id,
        "full_name": order.full_name,
        "city": order.city,
        "total_amount": str(order.total_amount),
        "status": order.status,
        "item_count": sum(item.quantity for item in order.items.all()),
        "created_at": order.created_at,
        "packed_at": order.packed_at,
        "assigned_at": order.assigned_at,
        "delivery_assigned_at": order.delivery_assigned_at,
    }


def lane_board(lane):

    profiles = StaffProfile.objects.filter(
        role=lane.role,
        approval_status="approved",
    ).select_related("user").order_by(
        "-is_punched_in", "user__first_name", "user__username"
    )

    active = {
        getattr(order, f"{lane.person_field}_id"): order
        for order in Order.objects.filter(
            **{f"{lane.person_field}__isnull": False},
            status__in=lane.statuses,
        ).prefetch_related("items")
    }

    people = []

    for profile in profiles:
        current = active.get(profile.user_id)

        people.append({
            "id": profile.user_id,
            "username": profile.user.username,
            "full_name": profile.user.get_full_name() or profile.user.username,
            "is_active": profile.user.is_active,
            "is_punched_in": profile.is_punched_in,
            "punched_in_at": profile.punched_in_at,
            "punched_out_at": profile.punched_out_at,
            "current_order": order_summary(current) if current else None,
        })

    return {
        "people": people,
        "queue": [order_summary(order) for order in waiting_orders(lane).prefetch_related("items")],
        "on_shift": sum(1 for person in people if person["is_punched_in"]),
        "busy": len(active),
    }


class AssignmentBoardView(APIView):

    # Admins and managers watch both queues; only managers reassign.
    permission_classes = [IsManagerOrAdmin]

    def get(self, request):

        return Response({
            "can_reassign": get_user_role(request.user) == "manager",
            "packing": lane_board(PACKING),
            "delivery": lane_board(DELIVERY),
        }, status=status.HTTP_200_OK)


class AdminOrderAssignView(APIView):

    permission_classes = [IsManager]

    def post(self, request, order_id):

        serializer = OrderAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        employee_id = serializer.validated_data["employee"]
        lane = LANES[serializer.validated_data["lane"]]

        with transaction.atomic():

            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=order_id,
            )

            # Packing: not yet packed. Delivery: packed but not yet picked up,
            # or shipped with nobody assigned (orders from before delivery
            # partners existed).
            reassignable = Order.OPEN_STATUSES if lane is PACKING else ("packed",)

            unowned_shipment = (
                lane is DELIVERY
                and order.status == "shipped"
                and order.delivery_person_id is None
            )

            if order.status not in reassignable and not unowned_shipment:
                return Response(
                    {
                        "detail":
                        "Only orders not yet packed can be reassigned for packing."
                        if lane is PACKING else
                        "Only packed orders not yet picked up can be reassigned for delivery."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if employee_id is None:
                # Back to the queue.
                setattr(order, lane.person_field, None)
                setattr(order, lane.time_field, None)

            else:
                profile = available_profiles(lane).select_for_update().filter(
                    user_id=employee_id
                ).select_related("user").first()

                if profile is None:
                    return Response(
                        {"detail": "That person is not punched in for this work."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                busy_with = active_order_for(profile.user, lane)

                if busy_with is not None and busy_with.pk != order.pk:
                    return Response(
                        {
                            "detail":
                            f"{profile.user.get_full_name() or profile.user.username} "
                            f"is already working on order #CN{busy_with.pk:06d}."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                now = timezone.now()
                setattr(order, lane.person_field, profile.user)
                setattr(order, lane.time_field, now)

                profile.last_assigned_at = now
                profile.save(update_fields=["last_assigned_at", "updated_at"])

            order.save(update_fields=[lane.person_field, lane.time_field, "updated_at"])

        # The previous person (if any) is now free for the next order.
        assign_waiting_orders()

        return Response(
            StaffOrderSerializer(staff_orders(request.user).get(pk=order.pk)).data,
            status=status.HTTP_200_OK
        )


# ==========================================
# STAFF ATTENDANCE REPORT
# ==========================================

def month_bounds(month_param):
    """(first moment of the month, first moment of the next month, "YYYY-MM").

    Uses the store's local time zone; defaults to the current month.
    """

    today = timezone.localdate()

    try:
        year, month = (int(part) for part in month_param.split("-"))
        first_day = date(year, month, 1)
    except (AttributeError, ValueError):
        first_day = today.replace(day=1)

    next_month = (first_day.replace(day=28) + timedelta(days=4)).replace(day=1)
    zone = timezone.get_current_timezone()

    return (
        timezone.make_aware(datetime.combine(first_day, time.min), zone),
        timezone.make_aware(datetime.combine(next_month, time.min), zone),
        first_day.strftime("%Y-%m"),
    )


def shift_seconds(shift, now):
    # Estimated days have no known hours; a shift still going on counts up to now.
    if shift.is_estimated:
        return 0
    end = shift.punched_out_at or now
    return max(0, int((end - shift.punched_in_at).total_seconds()))


def attendance_for(user, start, end):
    """One person's shifts in [start, end), grouped by the day they started."""

    now = timezone.now()
    shifts = ShiftRecord.objects.filter(
        user=user, punched_in_at__gte=start, punched_in_at__lt=end
    ).order_by("punched_in_at")

    days = {}

    for shift in shifts:
        day = timezone.localtime(shift.punched_in_at).date()
        seconds = shift_seconds(shift, now)
        entry = days.setdefault(
            day, {"date": day.isoformat(), "seconds": 0, "estimated": True, "shifts": []}
        )
        entry["seconds"] += seconds
        # A day is "estimated" only if it has no real punches at all.
        entry["estimated"] = entry["estimated"] and shift.is_estimated
        entry["shifts"].append({
            "punched_in_at": shift.punched_in_at,
            "punched_out_at": shift.punched_out_at,
            "seconds": seconds,
            "open": shift.punched_out_at is None,
            "estimated": shift.is_estimated,
            "note": shift.note,
        })

    total = sum(entry["seconds"] for entry in days.values())

    return {
        "days_present": len(days),
        "estimated_days": sum(1 for entry in days.values() if entry["estimated"]),
        "shift_count": sum(len(entry["shifts"]) for entry in days.values()),
        "total_seconds": total,
        "days": [days[day] for day in sorted(days)],
    }


def person_summary(profile):
    user = profile.user
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.get_full_name() or user.username,
        "role": profile.role,
        "is_active": user.is_active,
        "is_punched_in": profile.is_punched_in,
    }


class AttendanceView(APIView):
    """Monthly attendance.

    Store staff and delivery staff see their own month. Admins and managers
    see everyone who punches in, or one person with ?user=<id>.
    """

    permission_classes = [IsStoreStaff]

    def get(self, request):

        start, end, month = month_bounds(request.query_params.get("month", ""))
        role = get_user_role(request.user)

        shift_workers = StaffProfile.objects.filter(
            role__in=["employee", "delivery"],
            approval_status="approved",
        ).select_related("user")

        if role in ("employee", "delivery"):
            profile = request.user.staff_profile
        elif request.query_params.get("user"):
            profile = get_object_or_404(shift_workers, user_id=request.query_params["user"])
        else:
            people = []

            for profile in shift_workers.order_by("role", "user__first_name", "user__username"):
                report = attendance_for(profile.user, start, end)
                report.pop("days")
                people.append({**person_summary(profile), **report})

            return Response({"month": month, "people": people}, status=status.HTTP_200_OK)

        return Response({
            "month": month,
            "person": person_summary(profile),
            **attendance_for(profile.user, start, end),
        }, status=status.HTTP_200_OK)
