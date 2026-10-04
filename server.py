import http.server
import json
import os
import re
import sys
import mimetypes
from pathlib import Path
from http.cookies import SimpleCookie

PORT = int(os.environ.get("PORT", 5000))
DIRECTORY = Path(__file__).parent.resolve()
DB_FILE = DIRECTORY / "app_data.json"

DEFAULT_SETTINGS = {
    "theme_name": "CineBox",
    "footer_text": "Your ultimate destination for cinematic experiences. Stream the latest movies and TV shows in high definition.",
    "logo_url": "/assets/cinebox-logo.png",
    "favicon_url": "/assets/cinebox-logo.png",
    "copyright_text": "© 2026 CineBox. All rights reserved.",
    "explore_menu_title": "Explore",
    "support_menu_title": "Support",
    "header_code": "",
    "footer_script": "",
    "enable_header_ads": 0,
    "header_ads_code": "",
    "enable_sidebar_ads": 0,
    "sidebar_ads_code": "",
    "enable_in_content_ads": 0,
    "in_content_ads_code": "",
    "enable_footer_ads": 0,
    "footer_ads_code": "",
    "enable_popads": 0,
    "popads_code": "",
    "enable_google_ads": 0,
    "google_ads_code": "",
    "banner_ads_code": ""
}

DEFAULT_PAGES = [
    {
        "id": 1,
        "title": "About CineBox",
        "slug": "about-us",
        "content": "Welcome to CineBox! We offer a rich catalog of movies and television series streamed in ultra-high fidelity.",
        "menu_location": "explore",
        "order_index": 0
    },
    {
        "id": 2,
        "title": "Trending Guide",
        "slug": "trending-guide",
        "content": "Discover the most popular movies and shows updated weekly based on audience viewership worldwide.",
        "menu_location": "explore",
        "order_index": 1
    },
    {
        "id": 3,
        "title": "Terms of Service",
        "slug": "terms-of-service",
        "content": "These terms govern your use of the CineBox streaming platform. Enjoy streaming responsibly!",
        "menu_location": "support",
        "order_index": 0
    },
    {
        "id": 4,
        "title": "Privacy Policy",
        "slug": "privacy-policy",
        "content": "We respect your privacy. No personal data is sold or shared with unauthorized third parties.",
        "menu_location": "support",
        "order_index": 1
    }
]

DEFAULT_USER = {
    "id": 1,
    "name": "Admin",
    "email": "admin@cinebox.com",
    "role": "admin"
}

def load_data():
    if not DB_FILE.exists():
        data = {
            "settings": DEFAULT_SETTINGS.copy(),
            "pages": list(DEFAULT_PAGES),
            "users": [DEFAULT_USER],
            "current_user": DEFAULT_USER.copy()
        }
        save_data(data)
        return data
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "settings": DEFAULT_SETTINGS.copy(),
            "pages": list(DEFAULT_PAGES),
            "users": [DEFAULT_USER],
            "current_user": DEFAULT_USER.copy()
        }

def save_data(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

class CineBoxRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 0:
                raw = self.rfile.read(length).decode("utf-8")
                return json.loads(raw)
        except Exception:
            pass
        return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split("?")[0]

        # API: settings
        if clean_path == "/api/settings":
            data = load_data()
            return self.send_json(200, data.get("settings", DEFAULT_SETTINGS))

        # API: pages
        if clean_path == "/api/pages":
            data = load_data()
            return self.send_json(200, data.get("pages", DEFAULT_PAGES))

        # API: pages/:id or slug
        page_match = re.match(r"^/api/pages/([^/]+)$", clean_path)
        if page_match:
            param = page_match.group(1)
            data = load_data()
            pages = data.get("pages", [])
            for p in pages:
                if str(p.get("id")) == param or p.get("slug") == param:
                    return self.send_json(200, p)
            return self.send_json(404, {"error": "Page not found"})

        # API: auth me
        if clean_path == "/api/auth/me":
            data = load_data()
            user = data.get("current_user")
            return self.send_json(200, {"user": user})

        # Static asset or SPA routing
        target_path = self.translate_path(self.path)
        if os.path.exists(target_path) and not os.path.isdir(target_path):
            return super().do_GET()

        # Fallback to index.html for client-side React routes
        self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        clean_path = self.path.split("?")[0]
        body = self.read_json_body()
        data = load_data()

        if clean_path == "/api/settings/reset":
            data["settings"] = DEFAULT_SETTINGS.copy()
            save_data(data)
            return self.send_json(200, {"message": "Settings reset to defaults"})

        if clean_path == "/api/pages":
            pages = data.setdefault("pages", [])
            new_id = max([p.get("id", 0) for p in pages], default=0) + 1
            page = {
                "id": new_id,
                "title": body.get("title", ""),
                "slug": body.get("slug", f"page-{new_id}"),
                "content": body.get("content", ""),
                "menu_location": body.get("menu_location", "explore"),
                "order_index": body.get("order_index", len(pages))
            }
            pages.append(page)
            save_data(data)
            return self.send_json(201, page)

        if clean_path == "/api/pages/reorder":
            order_list = body.get("pages", [])
            order_map = {item["id"]: item.get("order_index", idx) for idx, item in enumerate(order_list)}
            for page in data.get("pages", []):
                if page["id"] in order_map:
                    page["order_index"] = order_map[page["id"]]
            data["pages"].sort(key=lambda x: x.get("order_index", 0))
            save_data(data)
            return self.send_json(200, {"message": "Pages reordered successfully"})

        if clean_path == "/api/auth/login":
            email = body.get("email", "")
            # Return active or create admin user session
            user = {
                "id": 1,
                "name": email.split("@")[0].capitalize() or "Admin",
                "email": email,
                "role": "admin"
            }
            data["current_user"] = user
            save_data(data)
            return self.send_json(200, {"user": user})

        if clean_path == "/api/auth/register":
            name = body.get("name", "User")
            email = body.get("email", "")
            user = {
                "id": len(data.get("users", [])) + 1,
                "name": name,
                "email": email,
                "role": "admin"
            }
            data.setdefault("users", []).append(user)
            data["current_user"] = user
            save_data(data)
            return self.send_json(201, {"user": user})

        if clean_path == "/api/auth/logout":
            data["current_user"] = None
            save_data(data)
            return self.send_json(200, {"message": "Logged out successfully"})

        if clean_path == "/api/activate":
            key = body.get("key", "")
            return self.send_json(200, {"success": True, "message": "License key activated successfully!"})

        return self.send_json(404, {"error": "Not found"})

    def do_PUT(self):
        clean_path = self.path.split("?")[0]
        body = self.read_json_body()
        data = load_data()

        if clean_path == "/api/settings":
            data.setdefault("settings", {}).update(body)
            save_data(data)
            return self.send_json(200, {"message": "Settings saved successfully", "settings": data["settings"]})

        page_match = re.match(r"^/api/pages/([^/]+)$", clean_path)
        if page_match:
            page_id = page_match.group(1)
            for page in data.get("pages", []):
                if str(page.get("id")) == page_id:
                    page.update(body)
                    save_data(data)
                    return self.send_json(200, page)
            return self.send_json(404, {"error": "Page not found"})

        return self.send_json(404, {"error": "Not found"})

    def do_DELETE(self):
        clean_path = self.path.split("?")[0]
        data = load_data()

        page_match = re.match(r"^/api/pages/([^/]+)$", clean_path)
        if page_match:
            page_id = page_match.group(1)
            initial_len = len(data.get("pages", []))
            data["pages"] = [p for p in data.get("pages", []) if str(p.get("id")) != page_id]
            if len(data["pages"]) < initial_len:
                save_data(data)
                return self.send_json(200, {"message": "Page deleted"})
            return self.send_json(404, {"error": "Page not found"})

        return self.send_json(404, {"error": "Not found"})

def run():
    # Make sure text/javascript and css are properly registered
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    mimetypes.add_type("image/svg+xml", ".svg")

    port = PORT
    httpd = None
    candidate_ports = [port, 5000, 5001, 8080, 8000, 3000]
    # Remove duplicates while preserving order
    candidate_ports = list(dict.fromkeys(candidate_ports))

    for p in candidate_ports:
        try:
            server_address = ("0.0.0.0", p)
            httpd = http.server.ThreadingHTTPServer(server_address, CineBoxRequestHandler)
            port = p
            break
        except OSError:
            continue

    if not httpd:
        # Fallback to ephemeral port
        server_address = ("0.0.0.0", 0)
        httpd = http.server.ThreadingHTTPServer(server_address, CineBoxRequestHandler)
        port = httpd.server_port

    print("==================================================")
    print("           CineBox Server is RUNNING!             ")
    print("==================================================")
    print(f" -> Local URL:   http://localhost:{port}")
    print(f" -> Network URL: http://127.0.0.1:{port}")
    print("==================================================")
    sys.stdout.flush()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

if __name__ == "__main__":
    run()
