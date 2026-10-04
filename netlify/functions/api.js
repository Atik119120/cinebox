const defaultData = {
  settings: {
    theme_name: "CineBox",
    footer_text: "Your ultimate destination for cinematic experiences. Stream the latest movies and TV shows in high definition.",
    logo_url: "/assets/cinebox-logo.png",
    favicon_url: "/assets/cinebox-logo.png",
    copyright_text: "© 2026 CineBox. All rights reserved.",
    explore_menu_title: "Explore",
    support_menu_title: "Support",
    header_code: "",
    footer_script: "",
    enable_header_ads: 0,
    header_ads_code: "",
    enable_sidebar_ads: 0,
    sidebar_ads_code: "",
    enable_in_content_ads: 0,
    in_content_ads_code: "",
    enable_footer_ads: 0,
    footer_ads_code: "",
    enable_popads: 0,
    popads_code: "",
    enable_google_ads: 0,
    google_ads_code: "",
    banner_ads_code: ""
  },
  pages: [
    {
      id: 1,
      title: "About CineBox",
      slug: "about-us",
      content: "Welcome to CineBox! We offer a rich catalog of movies and television series streamed in ultra-high fidelity.",
      menu_location: "explore",
      order_index: 0
    },
    {
      id: 2,
      title: "Trending Guide",
      slug: "trending-guide",
      content: "Discover the most popular movies and shows updated weekly based on audience viewership worldwide.",
      menu_location: "explore",
      order_index: 1
    },
    {
      id: 3,
      title: "Terms of Service",
      slug: "terms-of-service",
      content: "These terms govern your use of the CineBox streaming platform. Enjoy streaming responsibly!",
      menu_location: "support",
      order_index: 0
    },
    {
      id: 4,
      title: "Privacy Policy",
      slug: "privacy-policy",
      content: "We respect your privacy. No personal data is sold or shared with unauthorized third parties.",
      menu_location: "support",
      order_index: 1
    }
  ],
  users: [
    {
      id: 1,
      name: "Admin",
      email: "admin@cinebox.com",
      role: "admin"
    }
  ],
  current_user: {
    id: 1,
    name: "Admin",
    email: "admin@cinebox.com",
    role: "admin"
  }
};

let store = JSON.parse(JSON.stringify(defaultData));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ""
    };
  }

  // Normalize path
  let path = event.path || "";
  path = path.replace(/^\/\.netlify\/functions\/api/, "");
  path = path.replace(/^\/api/, "");
  if (!path.startsWith("/")) path = "/" + path;
  path = path.split("?")[0].replace(/\/+$/, "");

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      body = {};
    }
  }

  const method = event.httpMethod.toUpperCase();

  // GET routes
  if (method === "GET") {
    if (path === "/settings" || path === "") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(store.settings)
      };
    }

    if (path === "/pages") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(store.pages)
      };
    }

    const pageMatch = path.match(/^\/pages\/([^/]+)$/);
    if (pageMatch) {
      const param = pageMatch[1];
      const page = store.pages.find(p => String(p.id) === param || p.slug === param);
      if (page) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(page)
        };
      }
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Page not found" })
      };
    }

    if (path === "/auth/me") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ user: store.current_user })
      };
    }
  }

  // POST routes
  if (method === "POST") {
    if (path === "/settings/reset") {
      store.settings = JSON.parse(JSON.stringify(defaultData.settings));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Settings reset to defaults" })
      };
    }

    if (path === "/pages") {
      const newId = Math.max(0, ...store.pages.map(p => p.id || 0)) + 1;
      const newPage = {
        id: newId,
        title: body.title || "",
        slug: body.slug || `page-${newId}`,
        content: body.content || "",
        menu_location: body.menu_location || "explore",
        order_index: body.order_index ?? store.pages.length
      };
      store.pages.push(newPage);
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(newPage)
      };
    }

    if (path === "/pages/reorder") {
      const orderList = body.pages || [];
      const orderMap = {};
      orderList.forEach((item, idx) => {
        orderMap[item.id] = item.order_index ?? idx;
      });
      store.pages.forEach(p => {
        if (p.id in orderMap) p.order_index = orderMap[p.id];
      });
      store.pages.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Pages reordered successfully" })
      };
    }

    if (path === "/auth/login") {
      const email = body.email || "admin@cinebox.com";
      const name = (email.split("@")[0] || "Admin").replace(/^./, c => c.toUpperCase());
      const user = { id: 1, name, email, role: "admin" };
      store.current_user = user;
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ user })
      };
    }

    if (path === "/auth/register") {
      const name = body.name || "User";
      const email = body.email || "";
      const user = { id: store.users.length + 1, name, email, role: "admin" };
      store.users.push(user);
      store.current_user = user;
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ user })
      };
    }

    if (path === "/auth/logout") {
      store.current_user = null;
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Logged out successfully" })
      };
    }

    if (path === "/activate") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: "License key activated successfully!" })
      };
    }
  }

  // PUT routes
  if (method === "PUT") {
    if (path === "/settings") {
      Object.assign(store.settings, body);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Settings saved successfully", settings: store.settings })
      };
    }

    const pageMatch = path.match(/^\/pages\/([^/]+)$/);
    if (pageMatch) {
      const pageId = pageMatch[1];
      const page = store.pages.find(p => String(p.id) === pageId);
      if (page) {
        Object.assign(page, body);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(page)
        };
      }
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Page not found" })
      };
    }
  }

  // DELETE routes
  if (method === "DELETE") {
    const pageMatch = path.match(/^\/pages\/([^/]+)$/);
    if (pageMatch) {
      const pageId = pageMatch[1];
      const initialLen = store.pages.length;
      store.pages = store.pages.filter(p => String(p.id) !== pageId);
      if (store.pages.length < initialLen) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Page deleted" })
        };
      }
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Page not found" })
      };
    }
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: "Endpoint not found: " + path })
  };
};
