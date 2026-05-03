# EduSync - College Records Management System

EduSync is a comprehensive, PWA-enabled College Records Management System designed to streamline communication, assignments, and academic record tracking between college administration and students.

## ✨ Features

### For Students
* **Progress Dashboard**: View latest marks, attendance, and academic status.
* **Announcements**: Receive and view broadcasted announcements filtered by division.
* **Assignment Submission**: Securely upload assignment files directly to the administration.
* **PWA & Offline Support**: Install EduSync on your device for quick access, and view cached data even when offline.
* **Password Recovery**: Easily reset forgotten passwords via automated email recovery.

### For Administrators
* **Centralized Dashboard**: Manage student records efficiently.
* **Bulk Data Upload**: Upload student marks and details using Excel or PDF parsing.
* **Broadcast Announcements**: Send critical announcements dynamically filtered by active student divisions.
* **Assignment Management**: View and download assignments submitted by students.
* **Student Directory**: Add, edit, or archive student profiles easily.

---

## 🚀 How to Run Locally

Follow these steps to get EduSync up and running on your local machine.

### Prerequisites
* **Node.js**: Ensure Node.js is installed.
* **MySQL Server**: You need a running MySQL server on your local machine.

### 1. Database Setup
1. Open your MySQL client and create a new database (e.g., `college_records`).
   ```sql
   CREATE DATABASE college_records;
   ```
2. Navigate to `backend/db.js` in the project.
3. Update the `host`, `user`, `password`, and `database` fields to match your local MySQL credentials. The script will automatically create the necessary tables when the server starts.

### 2. Install Dependencies
Open your terminal, navigate to the `backend` directory, and install the required Node.js packages:
```bash
cd backend
npm install
```

### 3. Environment Variables
To enable the email recovery and notification features, create a `.env` file inside the `backend` directory (or move the one from the root folder) and add your email credentials:
```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```
*(Note: If using Gmail, you will need to generate an "App Password" from your Google Account settings).*

### 4. Start up the Server
From inside the `backend` directory, start the Express server:
```bash
npm start
```
*(For development with auto-reload, you can use `npm run dev`)*

The server will verify the database connection and print `Server is running on http://localhost:3000`.

### 5. Access the Application
Open your web browser and navigate to:
```
http://localhost:3000
```
Default Administrator accounts are automatically created on first run:
* **Username**: `admin` | **Password**: `admin123`
* **Username**: `admin2` | **Password**: `admin456`

---

## 🛠️ Tech Stack
* **Frontend**: HTML5, CSS3, Vanilla JavaScript, PWA (Service Workers, Manifest)
* **Backend**: Node.js, Express.js
* **Database**: MySQL
* **Key Libraries**: `multer` (file uploads), `xlsx` & `pdf-parse` (data extraction), `nodemailer` (email services)
