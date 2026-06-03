CREATE DATABASE IF NOT EXISTS college_records;
USE college_records;

CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Insert default admins for testing
INSERT IGNORE INTO admins (name, username, password) VALUES ('Admin User', 'admin', 'admin123'), ('Assistant Admin', 'admin2', 'admin456');

CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    enrollment_no VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    division VARCHAR(10) DEFAULT 'A',
    rank_no VARCHAR(50),
    extra_info TEXT DEFAULT NULL,
    archived_year VARCHAR(50) DEFAULT NULL,
    status ENUM('active', 'archived') DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_no VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    status ENUM('Present', 'Absent') NOT NULL,
    division VARCHAR(50),
    FOREIGN KEY (enrollment_no) REFERENCES students(enrollment_no) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS marks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_no VARCHAR(255) NOT NULL,
    course VARCHAR(100) DEFAULT 'Physics',
    subject VARCHAR(255) NOT NULL,
    marks INT NOT NULL,
    FOREIGN KEY (enrollment_no) REFERENCES students(enrollment_no) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    folder_name VARCHAR(255) DEFAULT 'root',
    visibility ENUM('public', 'private') DEFAULT 'public',
    uploaded_by VARCHAR(255) NOT NULL
);
