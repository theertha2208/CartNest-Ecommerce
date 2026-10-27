from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    AdminNotification, Category, Product, Order, OrderItem, StaffProfile, StockLog,
)


# ==========================================
# CUSTOMER ORDER CANCELLATION
# ==========================================

class CustomerCancelOrderTests(TestCase):

    def setUp(self):
        User = get_user_model()
        self.customer = User.objects.create_user(
            username="customer", password="pass12345"
        )
        self.other_customer = User.objects.create_user(
            username="other", password="pass12345"
        )

        category = Category.objects.create(name="Bakery", slug="bakery")
        self.product = Product.objects.create(
            category=category,
            name="Bread",
            slug="bread",
            description="Fresh bread",
            price=Decimal("40.00"),
            stock=5,
        )

        self.client = APIClient()
        self.client.force_authenticate(self.customer)

    def create_order(self, order_status="confirmed", user=None):
        order = Order.objects.create(
            user=user or self.customer,
            full_name="Test Customer",
            phone="9999999999",
            address="1 Market Street",
            city="Chennai",
            state="Tamil Nadu",
            postal_code="600001",
            total_amount=Decimal("80.00"),
            status=order_status,
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            quantity=2,
            price=self.product.price,
        )
        return order

    def cancel(self, order, data=None):
        return self.client.post(
            f"/api/orders/{order.id}/cancel/", data or {}, format="json"
        )

    def test_confirmed_order_can_be_cancelled_and_stock_is_returned(self):
        order = self.create_order("confirmed")

        response = self.cancel(order, {"reason": "Ordered by mistake"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "cancelled")
        self.assertFalse(response.data["can_cancel"])

        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(order.status, "cancelled")
        self.assertEqual(
            order.cancellation_reason,
            "Cancelled by customer: Ordered by mistake",
        )
        self.assertIsNotNone(order.cancelled_at)
        self.assertEqual(self.product.stock, 7)

    def test_reason_is_optional(self):
        order = self.create_order("pending")

        response = self.cancel(order)

        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.cancellation_reason, "Cancelled by customer.")

    def test_packed_order_can_still_be_cancelled(self):
        order = self.create_order("packed")

        self.assertEqual(self.cancel(order).status_code, 200)

    def test_shipped_and_delivered_orders_cannot_be_cancelled(self):
        for order_status in ("shipped", "delivered"):
            order = self.create_order(order_status)

            response = self.cancel(order)

            self.assertEqual(response.status_code, 400)
            self.assertIn("can no longer be cancelled", response.data["detail"])
            order.refresh_from_db()
            self.assertEqual(order.status, order_status)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)

    def test_cancelled_order_cannot_be_cancelled_twice(self):
        order = self.create_order("confirmed")
        self.cancel(order)

        response = self.cancel(order)

        self.assertEqual(response.status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 7)

    def test_customer_cannot_cancel_someone_elses_order(self):
        order = self.create_order("confirmed", user=self.other_customer)

        response = self.cancel(order)

        self.assertEqual(response.status_code, 404)
        order.refresh_from_db()
        self.assertEqual(order.status, "confirmed")

    def test_order_list_reports_whether_cancellation_is_allowed(self):
        self.create_order("confirmed")
        self.create_order("shipped")

        response = self.client.get("/api/orders/")

        data = response.data["results"] if isinstance(response.data, dict) else response.data
        flags = {item["status"]: item["can_cancel"] for item in data}
        self.assertEqual(flags, {"confirmed": True, "shipped": False})


# ==========================================
# ADMIN NEW-ORDER NOTIFICATIONS
# ==========================================

class AdminNotificationTests(TestCase):

    def setUp(self):
        User = get_user_model()
        self.customer = User.objects.create_user(
            username="customer", password="pass12345"
        )
        self.admin = User.objects.create_user(
            username="boss", password="pass12345", is_staff=True
        )

        category = Category.objects.create(name="Bakery", slug="bakery")
        self.product = Product.objects.create(
            category=category,
            name="Bread",
            slug="bread",
            description="Fresh bread",
            price=Decimal("40.00"),
            stock=5,
        )

        self.customer_client = APIClient()
        self.customer_client.force_authenticate(self.customer)

        self.admin_client = APIClient()
        self.admin_client.force_authenticate(self.admin)

    def place_order(self, quantity=2):
        self.customer_client.post(
            "/api/cart/add/",
            {"product_id": self.product.id, "quantity": quantity},
            format="json",
        )
        return self.customer_client.post(
            "/api/checkout/",
            {
                "full_name": "Asha Kumar",
                "phone": "9876543210",
                "address": "12 Market Street, Anna Nagar",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "postal_code": "600040",
                "payment_method": "cod",
            },
            format="json",
        )

    def test_checkout_creates_an_unread_notification(self):
        response = self.place_order(quantity=2)

        self.assertEqual(response.status_code, 201, response.data)
        notification = AdminNotification.objects.get()
        self.assertEqual(notification.order_id, response.data["id"])
        self.assertFalse(notification.is_read)
        self.assertEqual(notification.title, f"New order #CN{response.data['id']:06d}")
        self.assertIn("Asha Kumar ordered 2 items", notification.message)

    def test_failed_checkout_creates_no_notification(self):
        response = self.customer_client.post(
            "/api/checkout/", {}, format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(AdminNotification.objects.exists())

    def test_admin_lists_notifications_with_unread_count(self):
        self.place_order()
        self.place_order()

        response = self.admin_client.get("/api/admin/notifications/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["unread_count"], 2)
        self.assertEqual(len(response.data["results"]), 2)
        first = response.data["results"][0]
        self.assertEqual(first["order_status"], "confirmed")
        self.assertEqual(first["order_total"], "80.00")

    def test_customers_cannot_see_admin_notifications(self):
        self.place_order()

        response = self.customer_client.get("/api/admin/notifications/")

        self.assertEqual(response.status_code, 403)

    def test_mark_one_and_mark_all_as_read(self):
        self.place_order()
        self.place_order()
        first, second = AdminNotification.objects.order_by("id")

        response = self.admin_client.post(
            f"/api/admin/notifications/{first.id}/read/"
        )
        self.assertEqual(response.status_code, 204)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertTrue(first.is_read)
        self.assertFalse(second.is_read)

        response = self.admin_client.post("/api/admin/notifications/read-all/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(AdminNotification.objects.filter(is_read=False).exists())


# ==========================================
# ADMINS CAN BROWSE BUT NOT BUY
# ==========================================

class AdminCannotPurchaseTests(TestCase):

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username="boss", password="pass12345", is_staff=True
        )
        category = Category.objects.create(name="Bakery", slug="bakery")
        self.product = Product.objects.create(
            category=category,
            name="Bread",
            slug="bread",
            description="Fresh bread",
            price=Decimal("40.00"),
            stock=5,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_admin_can_still_browse_products_and_view_cart(self):
        self.assertEqual(self.client.get("/api/products/").status_code, 200)
        self.assertEqual(self.client.get("/api/categories/").status_code, 200)
        self.assertEqual(self.client.get("/api/cart/").status_code, 200)

    def test_admin_cannot_add_to_cart(self):
        response = self.client.post(
            "/api/cart/add/",
            {"product_id": self.product.id, "quantity": 1},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("cannot purchase", response.data["detail"])

    def test_admin_cannot_change_cart_quantity(self):
        response = self.client.patch(
            "/api/cart/items/1/", {"quantity": 2}, format="json"
        )

        self.assertEqual(response.status_code, 403)

    def test_admin_cannot_checkout(self):
        response = self.client.post(
            "/api/checkout/",
            {
                "full_name": "Store Admin",
                "phone": "9876543210",
                "address": "12 Market Street, Anna Nagar",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "postal_code": "600040",
                "payment_method": "cod",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Order.objects.exists())


# ==========================================
# STORE STAFF ROLES AND STOCK ACTIVITY LOG
# ==========================================

class StaffRoleTests(TestCase):

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(
            username="boss", password="pass12345", is_staff=True
        )
        self.manager = User.objects.create_user(username="mira", password="pass12345")
        StaffProfile.objects.create(user=self.manager, role="manager")
        self.employee = User.objects.create_user(username="eli", password="pass12345")
        StaffProfile.objects.create(user=self.employee, role="employee")
        self.customer = User.objects.create_user(username="cara", password="pass12345")

        self.category = Category.objects.create(name="Bakery", slug="bakery")
        self.product = Product.objects.create(
            category=self.category,
            name="Bread",
            slug="bread",
            description="Fresh bread",
            price=Decimal("40.00"),
            stock=5,
        )
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def login(self, username, password="pass12345"):
        return APIClient().post(
            "/api/auth/login/",
            {"username": username, "password": password},
            format="json",
        )

    def adjust(self, user, change, note=""):
        return self.as_user(user).post(
            f"/api/products/{self.product.id}/adjust-stock/",
            {"change": change, "note": note},
            format="json",
        )

    def test_login_reports_staff_roles(self):
        for username, role in [
            ("boss", "admin"),
            ("mira", "manager"),
            ("eli", "employee"),
            ("cara", "customer"),
        ]:
            response = self.login(username)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["user"]["role"], role)

    def test_admin_creates_employee_who_can_log_in(self):
        response = self.as_user(self.admin).post(
            "/api/admin/staff/",
            {
                "username": "newbie",
                "password": "Str0ng-pass-99",
                "first_name": "New",
                "role": "employee",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn("password", response.data)

        created = get_user_model().objects.get(username="newbie")
        self.assertFalse(created.is_staff)
        self.assertEqual(created.staff_profile.created_by, self.admin)

        login = self.login("newbie", "Str0ng-pass-99")
        self.assertEqual(login.data["user"]["role"], "employee")

    def test_admin_can_promote_employee_and_reset_password(self):
        response = self.as_user(self.admin).patch(
            f"/api/admin/staff/{self.employee.id}/",
            {"role": "manager", "password": "Brand-new-pass-7"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.login("eli", "Brand-new-pass-7").data["user"]["role"], "manager")

    def test_only_admins_and_managers_manage_staff(self):
        for user in (self.employee, self.customer):
            client = self.as_user(user)
            self.assertEqual(client.get("/api/admin/staff/").status_code, 403)
            response = client.post(
                "/api/admin/staff/",
                {"username": "x", "password": "Str0ng-pass-99", "role": "employee"},
                format="json",
            )
            self.assertEqual(response.status_code, 403)

    def test_manager_adds_staff_who_wait_for_admin_approval(self):
        response = self.as_user(self.manager).post(
            "/api/admin/staff/",
            {"username": "dev", "password": "Str0ng-pass-99", "role": "delivery"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["approval_status"], "pending")

        login = self.login("dev", "Str0ng-pass-99")
        self.assertEqual(login.status_code, 401)
        self.assertIn("waiting for admin approval", str(login.data["detail"]))

        # Managers cannot approve; admins can.
        new_id = response.data["id"]
        url = f"/api/admin/staff/{new_id}/approve/"
        self.assertEqual(self.as_user(self.manager).post(url, {"decision": "approve"}, format="json").status_code, 403)
        approved = self.as_user(self.admin).post(url, {"decision": "approve"}, format="json")
        self.assertEqual(approved.data["approval_status"], "approved")

        self.assertEqual(self.login("dev", "Str0ng-pass-99").data["user"]["role"], "delivery")

    def test_rejected_staff_cannot_log_in(self):
        response = self.as_user(self.manager).post(
            "/api/admin/staff/",
            {"username": "nope", "password": "Str0ng-pass-99", "role": "employee"},
            format="json",
        )
        self.as_user(self.admin).post(
            f"/api/admin/staff/{response.data['id']}/approve/", {"decision": "reject"}, format="json"
        )
        login = self.login("nope", "Str0ng-pass-99")
        self.assertEqual(login.status_code, 401)
        self.assertIn("not approved", str(login.data["detail"]))

    def test_managers_cannot_create_managers_or_see_them(self):
        response = self.as_user(self.manager).post(
            "/api/admin/staff/",
            {"username": "boss2", "password": "Str0ng-pass-99", "role": "manager"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        listed = self.as_user(self.manager).get("/api/admin/staff/").data
        self.assertNotIn("mira", [row["username"] for row in listed])

    def test_admin_creates_managers_approved_immediately(self):
        response = self.as_user(self.admin).post(
            "/api/admin/staff/",
            {"username": "max", "password": "Str0ng-pass-99", "role": "manager"},
            format="json",
        )
        self.assertEqual(response.data["approval_status"], "approved")
        self.assertEqual(self.login("max", "Str0ng-pass-99").data["user"]["role"], "manager")

    def test_only_admins_delete_staff(self):
        self.assertEqual(
            self.as_user(self.manager).delete(f"/api/admin/staff/{self.employee.id}/").status_code, 403
        )

    def test_deactivated_staff_cannot_log_in(self):
        self.as_user(self.admin).patch(
            f"/api/admin/staff/{self.employee.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(self.login("eli").status_code, 401)

    def test_employee_can_view_but_not_change_stock(self):
        client = self.as_user(self.employee)
        self.assertEqual(client.get("/api/admin/orders/").status_code, 200)
        self.assertEqual(client.get("/api/admin/dashboard/stats/").status_code, 200)
        self.assertEqual(client.get("/api/categories/").status_code, 200)
        self.assertEqual(client.get("/api/products/").status_code, 200)

        self.assertEqual(self.adjust(self.employee, 3).status_code, 403)

        client = self.as_user(self.employee)
        self.assertEqual(
            client.patch(
                f"/api/products/{self.product.id}/", {"stock": 50}, format="json"
            ).status_code,
            403,
        )
        self.assertEqual(
            client.delete(f"/api/products/{self.product.id}/").status_code, 403
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)

    def test_employee_packs_but_admin_and_manager_do_not_advance_orders(self):
        order = Order.objects.create(
            user=self.customer,
            full_name="Cara",
            phone="9876543210",
            address="12 Market Street, Anna Nagar",
            city="Chennai",
            state="Tamil Nadu",
            postal_code="600040",
            total_amount=Decimal("40.00"),
            assigned_to=self.employee,
        )

        url = f"/api/admin/orders/{order.id}/status/"

        response = self.as_user(self.employee).patch(url, {"status": "packed"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)

        for user in (self.manager, self.admin):
            response = self.as_user(user).patch(url, {"status": "shipped"}, format="json")
            self.assertEqual(response.status_code, 403)

        order.refresh_from_db()
        self.assertEqual(order.status, "packed")

    def test_managers_receive_new_order_notifications(self):
        self.assertEqual(
            self.as_user(self.manager).get("/api/admin/notifications/").status_code, 200
        )

        # Employees get orders through assignment instead.
        for user in (self.employee, self.customer):
            self.assertEqual(
                self.as_user(user).get("/api/admin/notifications/").status_code, 403
            )

    def test_employee_and_manager_cannot_reach_admin_only_pages(self):
        for user in (self.manager, self.employee):
            client = self.as_user(user)
            for url in (
                "/api/admin/customers/",
                "/api/admin/analytics/",
                "/api/admin/settings/",
                "/api/admin/stock-logs/",
            ):
                self.assertEqual(client.get(url).status_code, 403, url)

            response = client.post(
                "/api/categories/", {"name": "New", "slug": "new"}, format="json"
            )
            self.assertEqual(response.status_code, 403)

    def test_staff_cannot_purchase_and_are_not_counted_as_customers(self):
        for user in (self.manager, self.employee):
            response = self.as_user(user).post(
                "/api/cart/add/",
                {"product_id": self.product.id, "quantity": 1},
                format="json",
            )
            self.assertEqual(response.status_code, 403)

        stats = self.as_user(self.admin).get("/api/admin/dashboard/stats/")
        self.assertEqual(stats.data["total_customers"], 1)

        customers = self.as_user(self.admin).get("/api/admin/customers/")
        self.assertEqual(
            [c["username"] for c in customers.data["customers"]], ["cara"]
        )

    def test_manager_adds_and_removes_stock_and_it_is_logged(self):
        response = self.adjust(self.manager, 10, "Supplier delivery")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["stock"], 15)

        response = self.adjust(self.manager, -4, "Damaged")
        self.assertEqual(response.data["stock"], 11)

        added, removed = StockLog.objects.order_by("id")
        self.assertEqual(
            (added.action, added.quantity_change, added.stock_after),
            ("stock_added", 10, 15),
        )
        self.assertEqual(
            (removed.action, removed.quantity_change, removed.stock_after),
            ("stock_removed", -4, 11),
        )
        self.assertEqual(added.performed_by, self.manager)
        self.assertEqual(added.performed_by_role, "manager")
        self.assertEqual(added.note, "Supplier delivery")

    def test_cannot_remove_more_stock_than_available(self):
        response = self.adjust(self.manager, -6)
        self.assertEqual(response.status_code, 400)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertFalse(StockLog.objects.exists())

    def test_manager_product_create_and_delete_are_logged(self):
        client = self.as_user(self.manager)
        response = client.post(
            "/api/products/",
            {
                "category": self.category.id,
                "name": "Buns",
                "slug": "buns",
                "description": "Soft buns",
                "price": "30.00",
                "stock": 8,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

        response = client.delete(f"/api/products/{response.data['id']}/")
        self.assertEqual(response.status_code, 204)

        logs = list(
            StockLog.objects.order_by("id").values_list(
                "action", "product_name", "stock_after"
            )
        )
        self.assertEqual(
            logs, [("product_created", "Buns", 8), ("product_deleted", "Buns", 0)]
        )

        # The history survives the product being deleted.
        self.assertIsNone(StockLog.objects.get(action="product_deleted").product)

    def test_admin_sees_stock_log_with_who_did_what(self):
        self.adjust(self.manager, 10)
        self.adjust(self.admin, -2)

        response = self.as_user(self.admin).get("/api/admin/stock-logs/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(response.data["units_added"], 10)
        self.assertEqual(response.data["units_removed"], 2)
        self.assertEqual(
            [
                (row["performed_by_name"], row["action"])
                for row in response.data["results"]
            ],
            [("boss", "stock_removed"), ("mira", "stock_added")],
        )

        filtered = self.as_user(self.admin).get("/api/admin/stock-logs/?role=manager")
        self.assertEqual(filtered.data["count"], 1)


class StockAlertTests(TestCase):

    def setUp(self):
        User = get_user_model()
        self.employee = User.objects.create_user(username="eli", password="pass12345")
        StaffProfile.objects.create(user=self.employee, role="employee")
        self.customer = User.objects.create_user(username="cara", password="pass12345")

        category = Category.objects.create(name="Bakery", slug="bakery")
        for name, stock in [("Empty", 0), ("One", 1), ("Five", 5), ("Six", 6), ("Plenty", 40)]:
            Product.objects.create(
                category=category,
                name=name,
                slug=name.lower(),
                description=name,
                price=Decimal("10.00"),
                stock=stock,
            )
        self.client = APIClient()

    def test_lists_out_of_stock_and_low_stock_below_six(self):
        self.client.force_authenticate(self.employee)
        response = self.client.get("/api/admin/stock-alerts/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([p["name"] for p in response.data["out_of_stock"]], ["Empty"])
        self.assertEqual([p["name"] for p in response.data["low_stock"]], ["One", "Five"])
        self.assertEqual(response.data["out_of_stock_count"], 1)
        self.assertEqual(response.data["low_stock_count"], 2)

    def test_customers_cannot_see_stock_alerts(self):
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get("/api/admin/stock-alerts/").status_code, 403)


# ==========================================
# AUTOMATIC ORDER ASSIGNMENT
# ==========================================

class AssignmentTestCase(TestCase):
    """Shared setup: an admin, a manager, two employees and a customer."""

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username="boss", password="pass12345", is_staff=True)
        self.manager = User.objects.create_user(username="mira", password="pass12345")
        StaffProfile.objects.create(user=self.manager, role="manager")

        self.ana = User.objects.create_user(username="ana", password="pass12345")
        StaffProfile.objects.create(user=self.ana, role="employee")
        self.ben = User.objects.create_user(username="ben", password="pass12345")
        StaffProfile.objects.create(user=self.ben, role="employee")

        self.dan = User.objects.create_user(username="dan", password="pass12345")
        StaffProfile.objects.create(user=self.dan, role="delivery")
        self.dia = User.objects.create_user(username="dia", password="pass12345")
        StaffProfile.objects.create(user=self.dia, role="delivery")

        self.customer = User.objects.create_user(username="cara", password="pass12345")

        category = Category.objects.create(name="Bakery", slug="bakery")
        self.product = Product.objects.create(
            category=category,
            name="Bread",
            slug="bread",
            description="Fresh bread",
            price=Decimal("40.00"),
            stock=100,
        )
        self.client = APIClient()

    # ---------- helpers ----------

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def checkout(self):
        client = self.as_user(self.customer)
        client.post("/api/cart/add/", {"product_id": self.product.id, "quantity": 1}, format="json")
        response = client.post(
            "/api/checkout/",
            {
                "full_name": "Cara Customer",
                "phone": "9876543210",
                "address": "12 Market Street, Anna Nagar",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "postal_code": "600040",
                "payment_method": "cod",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return Order.objects.get(pk=response.data["id"])

    def punch_in(self, user):
        return self.as_user(user).post("/api/staff/punch-in/")

    def punch_out(self, user):
        return self.as_user(user).post("/api/staff/punch-out/")

    def pack(self, user, order):
        return self.as_user(user).patch(
            f"/api/admin/orders/{order.id}/status/", {"status": "packed"}, format="json"
        )

    def assignee(self, order):
        order.refresh_from_db()
        return order.assigned_to

    def courier(self, order):
        order.refresh_from_db()
        return order.delivery_person

    def set_status(self, user, order, new_status, **extra):
        return self.as_user(user).patch(
            f"/api/admin/orders/{order.id}/status/", {"status": new_status, **extra}, format="json"
        )


class OrderAssignmentTests(AssignmentTestCase):


    def test_orders_wait_in_queue_until_an_employee_punches_in(self):
        order = self.checkout()
        self.assertIsNone(self.assignee(order))

        response = self.punch_in(self.ana)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_punched_in"])
        self.assertEqual(response.data["current_order"]["id"], order.id)
        self.assertEqual(self.assignee(order), self.ana)

    def test_one_order_at_a_time_and_next_after_packing(self):
        self.punch_in(self.ana)
        first, second = self.checkout(), self.checkout()

        self.assertEqual(self.assignee(first), self.ana)
        self.assertIsNone(self.assignee(second))  # waits in the queue

        self.assertEqual(self.pack(self.ana, first).status_code, 200)

        self.assertEqual(self.assignee(second), self.ana)
        self.assertEqual(self.assignee(first), self.ana)  # kept as a record

    def test_orders_rotate_between_free_employees(self):
        self.punch_in(self.ana)
        self.punch_in(self.ben)

        first, second, third = self.checkout(), self.checkout(), self.checkout()

        self.assertEqual({self.assignee(first), self.assignee(second)}, {self.ana, self.ben})
        self.assertIsNone(self.assignee(third))

        # Whoever packs first gets the waiting order.
        packer = self.assignee(second)
        self.pack(packer, second)
        self.assertEqual(self.assignee(third), packer)

    def test_rotation_prefers_the_employee_who_waited_longest(self):
        self.punch_in(self.ana)
        self.punch_in(self.ben)
        first = self.checkout()
        first_employee = self.assignee(first)
        other = self.ben if first_employee == self.ana else self.ana

        # Both free again: the next order goes to the one who has not had one yet.
        self.pack(first_employee, first)
        self.assertEqual(self.assignee(self.checkout()), other)

    def test_punch_out_stops_assignment_and_returns_order_to_queue(self):
        self.punch_in(self.ana)
        order = self.checkout()
        self.assertEqual(self.assignee(order), self.ana)

        response = self.punch_out(self.ana)
        self.assertFalse(response.data["is_punched_in"])
        self.assertIsNone(self.assignee(order))
        self.assertIsNone(self.assignee(self.checkout()))

        # Another employee picks the returned order up.
        self.punch_in(self.ben)
        self.assertEqual(self.assignee(order), self.ben)

    def test_employee_sees_and_packs_only_their_own_order(self):
        self.punch_in(self.ana)
        self.punch_in(self.ben)
        mine, theirs = self.checkout(), self.checkout()
        if self.assignee(mine) != self.ana:
            mine, theirs = theirs, mine

        listed = self.as_user(self.ana).get("/api/admin/orders/").data
        listed = listed["results"] if isinstance(listed, dict) else listed
        self.assertEqual([o["id"] for o in listed], [mine.id])
        self.assertEqual(self.as_user(self.ana).get(f"/api/admin/orders/{theirs.id}/").status_code, 404)

        self.assertEqual(self.pack(self.ana, theirs).status_code, 403)

        response = self.as_user(self.ana).patch(
            f"/api/admin/orders/{mine.id}/status/",
            {"status": "cancelled", "cancellation_reason": "x"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_managers_and_admins_see_all_orders(self):
        self.punch_in(self.ana)
        self.checkout()
        self.checkout()

        for user in (self.manager, self.admin):
            listed = self.as_user(user).get("/api/admin/orders/").data
            listed = listed["results"] if isinstance(listed, dict) else listed
            self.assertEqual(len(listed), 2)

    def test_manager_reassigns_to_a_free_employee(self):
        self.punch_in(self.ana)
        order = self.checkout()
        self.punch_in(self.ben)  # free, nothing waiting

        response = self.as_user(self.manager).post(
            f"/api/admin/orders/{order.id}/assign/", {"employee": self.ben.id}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["assigned_to"], self.ben.id)
        self.assertEqual(response.data["assigned_to_name"], "ben")

    def test_cannot_give_a_busy_or_off_shift_employee_a_second_order(self):
        self.punch_in(self.ana)
        self.punch_in(self.ben)
        first, second = self.checkout(), self.checkout()
        busy = self.assignee(first)

        response = self.as_user(self.manager).post(
            f"/api/admin/orders/{second.id}/assign/", {"employee": busy.id}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("already working on", response.data["detail"])

        self.punch_out(self.ben)
        self.punch_out(self.ana)
        response = self.as_user(self.manager).post(
            f"/api/admin/orders/{first.id}/assign/", {"employee": self.ana.id}, format="json"
        )
        self.assertEqual(response.status_code, 400)

        # Admins watch but do not reassign.
        response = self.as_user(self.admin).post(
            f"/api/admin/orders/{first.id}/assign/", {"employee": None}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_database_blocks_two_open_orders_for_one_employee(self):
        from django.db import IntegrityError, transaction

        first = self.checkout()
        second = self.checkout()
        Order.objects.filter(pk=first.pk).update(assigned_to=self.ana)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Order.objects.filter(pk=second.pk).update(assigned_to=self.ana)

    def test_cancelling_frees_the_employee(self):
        self.punch_in(self.ana)
        first, second = self.checkout(), self.checkout()

        response = self.as_user(self.customer).post(f"/api/orders/{first.id}/cancel/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.assignee(second), self.ana)

    def test_deactivating_an_employee_returns_their_order(self):
        self.punch_in(self.ana)
        order = self.checkout()

        self.as_user(self.admin).patch(
            f"/api/admin/staff/{self.ana.id}/", {"is_active": False}, format="json"
        )
        self.assertIsNone(self.assignee(order))
        self.assertFalse(StaffProfile.objects.get(user=self.ana).is_punched_in)

    def test_assignment_board_for_managers_and_admins(self):
        self.punch_in(self.ana)
        self.checkout()
        self.checkout()

        board = self.as_user(self.manager).get("/api/admin/assignments/")
        self.assertEqual(board.status_code, 200)
        self.assertTrue(board.data["can_reassign"])
        self.assertEqual(board.data["packing"]["on_shift"], 1)
        self.assertEqual(board.data["packing"]["busy"], 1)
        self.assertEqual(len(board.data["packing"]["queue"]), 1)

        admin_board = self.as_user(self.admin).get("/api/admin/assignments/")
        self.assertFalse(admin_board.data["can_reassign"])

        self.assertEqual(self.as_user(self.ana).get("/api/admin/assignments/").status_code, 403)

    def test_only_employees_punch_in(self):
        self.assertEqual(self.punch_in(self.manager).status_code, 403)
        self.assertEqual(self.punch_in(self.customer).status_code, 403)

    def test_customers_never_see_the_assigned_employee(self):
        self.punch_in(self.ana)
        order = self.checkout()

        response = self.as_user(self.customer).get(f"/api/orders/{order.id}/")
        self.assertNotIn("assigned_to", response.data)
        self.assertNotIn("assigned_to_name", response.data)


class OrderStatusFlowTests(AssignmentTestCase):
    """Placed -> Packed (employee) -> Shipped -> Delivered (delivery staff member), seen by the customer."""

    def test_full_flow_records_each_tracking_time(self):
        self.punch_in(self.ana)
        self.punch_in(self.dan)
        order = self.checkout()

        self.assertEqual(self.pack(self.ana, order).status_code, 200)
        self.assertEqual(self.courier(order), self.dan)
        self.assertEqual(self.set_status(self.dan, order, "shipped").status_code, 200)
        self.assertEqual(self.set_status(self.dan, order, "delivered").status_code, 200)

        tracked = self.as_user(self.customer).get(f"/api/orders/{order.id}/").data
        self.assertEqual(tracked["status"], "delivered")
        self.assertEqual(tracked["payment_status"], "paid")
        for field in ("packed_at", "shipped_at", "delivered_at"):
            self.assertIsNotNone(tracked[field], field)

    def test_steps_cannot_be_skipped(self):
        self.punch_in(self.ana)
        self.punch_in(self.dan)
        order = self.checkout()

        self.pack(self.ana, order)
        # Picked up (Shipped) must come before Delivered.
        self.assertEqual(self.set_status(self.dan, order, "delivered").status_code, 400)

    def test_employees_cannot_ship_or_deliver(self):
        self.punch_in(self.ana)
        order = self.checkout()
        self.pack(self.ana, order)

        self.assertEqual(self.set_status(self.ana, order, "shipped").status_code, 403)

    def test_manager_can_list_packed_orders(self):
        self.punch_in(self.ana)
        first, second = self.checkout(), self.checkout()
        self.pack(self.ana, first)

        listed = self.as_user(self.manager).get("/api/admin/orders/?status=packed").data
        listed = listed["results"] if isinstance(listed, dict) else listed
        self.assertEqual([o["id"] for o in listed], [first.id])
        self.assertEqual(listed[0]["assigned_to_name"], "ana")

    def test_order_list_filters_placed_orders_and_searches_by_number(self):
        self.punch_in(self.ana)
        first, second = self.checkout(), self.checkout()
        self.pack(self.ana, first)

        client = self.as_user(self.admin)

        placed = client.get("/api/admin/orders/?status=pending,confirmed").data
        self.assertEqual([o["id"] for o in placed["results"]], [second.id])

        found = client.get(f"/api/admin/orders/?search=%23CN{first.id:06d}").data
        self.assertEqual([o["id"] for o in found["results"]], [first.id])


# ==========================================
# DELIVERY PARTNERS
# ==========================================

class DeliveryAssignmentTests(AssignmentTestCase):

    def packed_order(self):
        """An order packed by ana (who is punched in)."""
        self.punch_in(self.ana)
        order = self.checkout()
        self.pack(self.ana, order)
        return order

    def test_packed_orders_wait_for_a_delivery_partner(self):
        order = self.packed_order()
        self.assertIsNone(self.courier(order))

        work = self.punch_in(self.dan).data
        self.assertEqual(work["role"], "delivery")
        self.assertEqual(work["current_order"]["id"], order.id)

    def test_one_delivery_at_a_time_and_next_after_delivered(self):
        self.punch_in(self.dan)
        first = self.packed_order()
        second = self.checkout()
        self.pack(self.ana, second)

        self.assertEqual(self.courier(first), self.dan)
        self.assertIsNone(self.courier(second))

        self.set_status(self.dan, first, "shipped")
        self.assertIsNone(self.courier(second))  # still busy while out for delivery

        self.set_status(self.dan, first, "delivered")
        self.assertEqual(self.courier(second), self.dan)

    def test_deliveries_rotate_between_partners(self):
        self.punch_in(self.dan)
        self.punch_in(self.dia)
        first = self.packed_order()
        second = self.checkout()
        self.pack(self.ana, second)

        self.assertEqual({self.courier(first), self.courier(second)}, {self.dan, self.dia})

    def test_delivery_partner_updates_only_their_own_order(self):
        self.punch_in(self.dan)
        order = self.packed_order()

        self.assertEqual(self.set_status(self.dia, order, "shipped").status_code, 403)
        self.assertEqual(
            self.set_status(self.dan, order, "cancelled", cancellation_reason="x").status_code, 403
        )

        listed = self.as_user(self.dia).get("/api/admin/orders/").data["results"]
        self.assertEqual(listed, [])

    def test_punch_out_returns_unpicked_order_but_keeps_shipped_one(self):
        self.punch_in(self.dan)
        order = self.packed_order()

        self.punch_out(self.dan)
        self.assertIsNone(self.courier(order))  # not picked up yet: back to queue

        self.punch_in(self.dan)
        self.set_status(self.dan, order, "shipped")
        self.punch_out(self.dan)
        self.assertEqual(self.courier(order), self.dan)  # has the parcel

        # They can still finish it after punching out.
        self.assertEqual(self.set_status(self.dan, order, "delivered").status_code, 200)

    def test_cancelling_a_packed_order_frees_the_delivery_partner(self):
        self.punch_in(self.dan)
        first = self.packed_order()
        second = self.checkout()
        self.pack(self.ana, second)

        response = self.set_status(self.manager, first, "cancelled", cancellation_reason="Customer called")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.courier(second), self.dan)

    def test_database_blocks_two_active_deliveries(self):
        from django.db import IntegrityError, transaction

        first = self.packed_order()
        second = self.checkout()
        self.pack(self.ana, second)
        Order.objects.filter(pk=first.pk).update(delivery_person=self.dan)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Order.objects.filter(pk=second.pk).update(delivery_person=self.dan)

    def test_manager_reassigns_a_delivery(self):
        self.punch_in(self.dan)
        order = self.packed_order()
        self.punch_in(self.dia)

        response = self.as_user(self.manager).post(
            f"/api/admin/orders/{order.id}/assign/",
            {"employee": self.dia.id, "lane": "delivery"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["delivery_person_name"], "dia")

    def test_pending_delivery_partner_gets_no_orders(self):
        StaffProfile.objects.filter(user=self.dia).update(approval_status="pending")
        self.punch_in(self.dia)
        order = self.packed_order()
        self.assertIsNone(self.courier(order))

    def test_old_shipped_orders_without_a_partner_get_delivered(self):
        order = self.packed_order()
        # Shipped before delivery staff existed: nobody owns it.
        Order.objects.filter(pk=order.pk).update(status="shipped")

        work = self.punch_in(self.dan).data
        self.assertEqual(work["current_order"]["id"], order.id)
        self.assertEqual(self.set_status(self.dan, order, "delivered").status_code, 200)


# ==========================================
# PRODUCT SKUs
# ==========================================

class ProductSkuTests(TestCase):

    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username="boss", password="pass12345", is_staff=True)
        self.manager = User.objects.create_user(username="mira", password="pass12345")
        StaffProfile.objects.create(user=self.manager, role="manager")
        self.category = Category.objects.create(name="Bakery", slug="bakery")
        self.client = APIClient()

    def create_product(self, user, name, **extra):
        self.client.force_authenticate(user)
        return self.client.post(
            "/api/products/",
            {
                "category": self.category.id,
                "name": name,
                "slug": name.lower().replace(" ", "-"),
                "description": name,
                "price": "40.00",
                "stock": 5,
                **extra,
            },
            format="json",
        )

    def test_new_products_get_a_unique_sku_automatically(self):
        first = self.create_product(self.manager, "Bread")
        second = self.create_product(self.admin, "Buns")

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["sku"], f"CN-BAK-BREAD-{first.data['id']:05d}")
        self.assertNotEqual(first.data["sku"], second.data["sku"])

    def test_sku_cannot_be_set_or_changed_by_hand(self):
        created = self.create_product(self.manager, "Bread", sku="MY-OWN-SKU")
        self.assertNotEqual(created.data["sku"], "MY-OWN-SKU")

        updated = self.client.patch(
            f"/api/products/{created.data['id']}/",
            {"sku": "CHANGED", "name": "Brown Bread"},
            format="json",
        )
        self.assertEqual(updated.data["sku"], created.data["sku"])

    def test_sku_survives_rename_and_category_change(self):
        product = Product.objects.create(
            category=self.category, name="Bread", slug="bread",
            description="Bread", price=Decimal("40.00"), stock=5,
        )
        sku = product.sku
        product.name = "Brown Bread"
        product.category = Category.objects.create(name="Snacks", slug="snacks")
        product.save()
        product.refresh_from_db()
        self.assertEqual(product.sku, sku)

    def test_database_rejects_duplicate_skus(self):
        from django.db import IntegrityError, transaction

        product = Product.objects.create(
            category=self.category, name="Bread", slug="bread",
            description="Bread", price=Decimal("40.00"), stock=5,
        )
        other = Product.objects.create(
            category=self.category, name="Buns", slug="buns",
            description="Buns", price=Decimal("30.00"), stock=5,
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.filter(pk=other.pk).update(sku=product.sku)

    def test_staff_search_products_by_sku(self):
        bread = self.create_product(self.manager, "Bread").data
        self.create_product(self.manager, "Buns")

        for user in (self.manager, self.admin):
            self.client.force_authenticate(user)

            found = self.client.get(f"/api/products/?search={bread['sku'].lower()}").data["results"]
            self.assertEqual([p["id"] for p in found], [bread["id"]])

            exact = self.client.get(f"/api/products/?sku={bread['sku']}").data["results"]
            self.assertEqual(len(exact), 1)
            for field in ("name", "category_name", "price", "stock", "is_available", "in_stock"):
                self.assertIn(field, exact[0])

    def test_sku_shows_category_product_and_size(self):
        from store.sku import build_sku

        self.assertEqual(build_sku("Beverages", "Mango Drink 1 L", 40), "CN-BEV-MANGO-DRINK-1L-00040")
        self.assertEqual(build_sku("Fresh Fruits", "Royal Gala Apples 1 kg", 3), "CN-FFR-ROYAL-APPLES-1KG-00003")
        self.assertEqual(build_sku("Dairy & Eggs", "Farm Fresh Eggs 6 pcs", 17), "CN-DEG-FARM-EGGS-6PC-00017")
        self.assertEqual(build_sku("Beverages", "Coconut Water 200 ml", 44), "CN-BEV-COCONU-WATER-200ML-00044")
        self.assertEqual(build_sku("Fruits", "Grapes", 1), "CN-FRU-GRAPES-00001")


# ==========================================
# STAFF ATTENDANCE
# ==========================================

class AttendanceTests(AssignmentTestCase):

    def shift(self, user, start, hours):
        from datetime import timedelta
        from store.models import ShiftRecord
        return ShiftRecord.objects.create(
            user=user, role=user.staff_profile.role,
            punched_in_at=start, punched_out_at=start + timedelta(hours=hours),
        )

    def at(self, year, month, day, hour):
        from datetime import datetime
        from django.utils import timezone
        return timezone.make_aware(datetime(year, month, day, hour))

    def test_punching_in_and_out_records_a_shift(self):
        from store.models import ShiftRecord

        self.punch_in(self.ana)
        shift = ShiftRecord.objects.get(user=self.ana)
        self.assertIsNone(shift.punched_out_at)

        self.punch_out(self.ana)
        shift.refresh_from_db()
        self.assertIsNotNone(shift.punched_out_at)

        self.punch_in(self.ana)
        self.assertEqual(ShiftRecord.objects.filter(user=self.ana).count(), 2)

    def test_monthly_report_counts_days_shifts_and_hours(self):
        self.shift(self.ana, self.at(2026, 9, 3, 9), 4)
        self.shift(self.ana, self.at(2026, 9, 3, 15), 3)   # second shift, same day
        self.shift(self.ana, self.at(2026, 9, 10, 9), 8)
        self.shift(self.ana, self.at(2026, 10, 1, 9), 8)   # next month: not counted

        report = self.as_user(self.ana).get("/api/attendance/?month=2026-09").data
        self.assertEqual(report["person"]["username"], "ana")
        self.assertEqual(report["days_present"], 2)
        self.assertEqual(report["shift_count"], 3)
        self.assertEqual(report["total_seconds"], 15 * 3600)
        self.assertEqual([day["date"] for day in report["days"]], ["2026-09-03", "2026-09-10"])
        self.assertEqual(report["days"][0]["seconds"], 7 * 3600)

    def test_staff_only_see_their_own_attendance(self):
        self.shift(self.ben, self.at(2026, 9, 3, 9), 4)

        # Asking for someone else still returns their own report.
        report = self.as_user(self.ana).get(f"/api/attendance/?month=2026-09&user={self.ben.id}").data
        self.assertEqual(report["person"]["username"], "ana")
        self.assertEqual(report["days_present"], 0)

        dan = self.as_user(self.dan).get("/api/attendance/?month=2026-09").data
        self.assertEqual(dan["person"]["role"], "delivery")

    def test_admins_and_managers_see_everyone_and_any_person(self):
        self.shift(self.ana, self.at(2026, 9, 3, 9), 4)
        self.shift(self.dan, self.at(2026, 9, 4, 9), 6)

        for viewer in (self.admin, self.manager):
            summary = self.as_user(viewer).get("/api/attendance/?month=2026-09").data
            hours = {row["username"]: row["total_seconds"] / 3600 for row in summary["people"]}
            self.assertEqual(hours, {"ana": 4, "ben": 0, "dan": 6, "dia": 0})

            detail = self.as_user(viewer).get(f"/api/attendance/?month=2026-09&user={self.dan.id}").data
            self.assertEqual(detail["person"]["username"], "dan")
            self.assertEqual(detail["days_present"], 1)

    def test_customers_cannot_see_attendance(self):
        self.assertEqual(self.as_user(self.customer).get("/api/attendance/").status_code, 403)

    def test_open_shift_counts_up_to_now(self):
        self.punch_in(self.ana)
        report = self.as_user(self.ana).get("/api/attendance/").data
        self.assertEqual(report["days_present"], 1)
        self.assertTrue(report["days"][0]["shifts"][0]["open"])

    def test_estimated_days_count_as_present_without_hours(self):
        from store.models import ShiftRecord

        start = self.at(2026, 9, 2, 19)
        ShiftRecord.objects.create(
            user=self.ana, role="employee", punched_in_at=start, punched_out_at=start,
            is_estimated=True, note="Estimated from work: packed 2 orders",
        )
        self.shift(self.ana, self.at(2026, 9, 3, 9), 4)

        report = self.as_user(self.ana).get("/api/attendance/?month=2026-09").data
        self.assertEqual(report["days_present"], 2)
        self.assertEqual(report["estimated_days"], 1)
        self.assertEqual(report["total_seconds"], 4 * 3600)
        self.assertTrue(report["days"][0]["estimated"])
        self.assertEqual(report["days"][0]["shifts"][0]["note"], "Estimated from work: packed 2 orders")
