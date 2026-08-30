# AbitStore Webhook -> Telegram v5

- invoice_status -> AbitStore namestatus, displayed UPPERCASE.
- AbitStore status color -> colored-circle indicator.
- Product image: products[0].image_info.image_url.
- One Telegram push only: sendPhoto with the order as caption.
- Order code is normal text (not emphasized).
- KH Trả = total.
- Doanh thu = ecom_doanhso.
- Date/time is converted from ISO UTC to Vietnam time and displayed HH:mm:ss - DD/MM/YYYY.
- Receiver format: receiver - phone_number (address).

Hardcoded Telegram settings are included as requested.
