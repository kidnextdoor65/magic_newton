# Developed by KidNextDoor

## t.me/kidnextdoor65

### Chức năng
**Roll dice mỗi 24h**

### Hướng Dẫn Sử Dụng
1. **Cách lấy token:**
     * Mở Developer Tools (F12) -> tab "Application" (Chrome) hoặc "Storage" (Firefox) -> Cookies -> `https://www.magicnewton.com`.
     * Sao chép giá trị đầy đủ của `__Secure-next-auth.session-token`,   `__Host-next-auth.csrf-token`.
2.  **Chuẩn bị dữ liệu tài khoản:**
    * Mở tệp `data.txt`.
    * Mỗi dòng trong tệp này chứa thông tin của một tài khoản Magic Newton.
    * **Định dạng mỗi dòng:** `SESSION_TOKEN|CSRF_TOKEN`
        * `SESSION_TOKEN`: Giá trị của cookie `__Secure-next-auth.session-token`.
        * `CSRF_TOKEN`: Giá trị của cookie `__Host-next-auth.csrf-token`.
3.  **Chạy Script:**

        npm install
    
        node main.js
