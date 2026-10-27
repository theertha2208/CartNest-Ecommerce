# CartNest – Full-Stack Ecommerce Website

CartNest is a full-stack e-commerce web application built using **React, Django REST Framework, and SQLite**. It combines an online shopping platform with a role-based store management system for administrators, managers, packing staff, and delivery staff.

The application supports customer shopping, product and inventory management, order processing, staff attendance, sequential order assignments, delivery tracking, and administrative analytics.

## Key Features

### Customer Features

- User registration and login
- Browse products and categories
- View product information and details
- Add products to the shopping cart
- Place orders through checkout
- Manage wishlists
- View order history and track order progress
- Manage customer profiles and delivery addresses
- Submit product reviews

### Administrator Features

- Admin dashboard with store information
- Product and category management
- Customer management
- Order management and tracking
- Staff account and role management
- Inventory and stock activity monitoring
- Staff attendance reports
- Store settings management
- Administrative analytics and reports
- Order notifications and alerts

### Manager Features

- Monitor store operations
- Coordinate order assignments
- Manage packing and delivery workflows
- Track order processing progress
- Monitor staff activities and assigned work
- Support day-to-day operational management

### Packing Staff Features

- Punch in to begin a work session
- Access a dedicated packing workspace
- Receive orders sequentially, one after another
- View order details and products to be packed
- Pack the assigned order
- Update the order's packing status
- Pass completed orders to the delivery workflow

### Delivery Staff Features

- Punch in to become available for delivery assignments
- Access a dedicated delivery workspace
- Receive orders after packing has been completed
- Receive delivery assignments sequentially
- View customer delivery addresses and order information
- Monitor assigned deliveries
- Update delivery progress and completion status

### Staff Attendance and Assignment Management

- Staff punch-in and attendance tracking
- Role-based staff workspaces
- Sequential order assignments
- Order status monitoring
- Staff activity and attendance reports
- Coordination between packing and delivery personnel

## Order Processing Workflow

CartNest uses a structured workflow to coordinate customer orders, packing staff, and delivery staff.

**Step 1 – Customer Places an Order**

The customer selects products, adds them to the shopping cart, and completes checkout.

**Step 2 – Order Enters the Packing Workflow**

The order becomes available for processing by packing staff.

**Step 3 – Packing Staff Receives the Order**

Available packing staff receive orders sequentially after punching in. Staff can view the assigned order details and pack the products.

**Step 4 – Packing Is Completed**

Once packing is completed, the order progresses to the delivery workflow.

**Step 5 – Delivery Staff Receives the Order**

Available delivery staff receive packed orders sequentially after punching in. They can view the customer address and relevant delivery information.

**Step 6 – Order Is Delivered**

Delivery staff complete the delivery and update the order status.

**Step 7 – Customer Tracks the Order**

Customers can monitor their orders through the order tracking interface.

### Workflow Overview

```text
Customer Places Order
         |
         v
   Order Processing
         |
         v
Packing Staff Punches In
         |
         v
Packing Order Assigned
         |
         v
   Order Is Packed
         |
         v
Delivery Staff Punches In
         |
         v
Delivery Order Assigned
         |
         v
Customer Address & Details
         |
         v
   Order Delivered
         |
         v
  Order Status Updated
```

## 💻 Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Python, Django, Django REST Framework |
| Database | SQLite |
| Authentication | JWT Authentication |
| API Architecture | REST APIs |
| Version Control | Git and GitHub |

## 📁 Project Structure

```text
CartNest/
|
├── backend/
│   ├── config/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   │
│   ├── store/
│   │   ├── management/
│   │   │   └── commands/
│   │   ├── migrations/
│   │   ├── admin.py
│   │   ├── assignment.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── sku.py
│   │   ├── urls.py
│   │   └── views.py
│   │
│   └── manage.py
│
├── frontend/
│   ├── public/
│   │   ├── cartnest-categories/
│   │   └── cartnest-products/
│   │
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

## ⚙️ Installation and Setup

### Prerequisites

Install the following software:

- Python
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/theertha2208/CartNest-Ecommerce.git
cd CartNest-Ecommerce
```

### 2. Backend Setup

Navigate to the backend folder:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it using Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the required Python dependencies, including Django, Django REST Framework, and the other packages imported by the backend.

Configure the Django secret key in your PowerShell session:

```powershell
$env:DJANGO_SECRET_KEY = "replace-with-your-own-secure-random-key"
```

This is a placeholder, not a real secret key. Generate and