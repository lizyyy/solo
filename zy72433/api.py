import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from core import (
    import_tuner_comment,
    supplement_rehearsal_signup,
    manual_correct,
    rerun_review,
    review_rework_complete,
    get_track_status,
)
from demo_data import create_demo_review, create_normal_demo_review, create_three_step_demo
from cli import demo_review_to_dict


reviews_store = {}


class DemoReviewHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status_code=200, content_type="application/json"):
        self.send_response(status_code)
        self.send_header("Content-type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/":
            self._set_headers(content_type="text/html")
            with open("kanban.html", "r", encoding="utf-8") as f:
                self.wfile.write(f.read().encode("utf-8"))
            return

        if parsed.path == "/api/demo":
            review = create_demo_review()
            reviews_store[review.id] = review
            self._set_headers()
            self.wfile.write(
                json.dumps(demo_review_to_dict(review), ensure_ascii=False).encode(
                    "utf-8"
                )
            )
            return

        if parsed.path == "/api/demo/normal":
            review = create_normal_demo_review()
            reviews_store[review.id] = review
            self._set_headers()
            self.wfile.write(
                json.dumps(demo_review_to_dict(review), ensure_ascii=False).encode(
                    "utf-8"
                )
            )
            return

        if parsed.path == "/api/demo/threestep":
            review = create_three_step_demo()
            reviews_store[review.id] = review
            self._set_headers()
            self.wfile.write(
                json.dumps(demo_review_to_dict(review), ensure_ascii=False).encode(
                    "utf-8"
                )
            )
            return

        if parsed.path == "/api/reviews":
            result = [demo_review_to_dict(r) for r in reviews_store.values()]
            self._set_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
            return

        if parsed.path.startswith("/api/reviews/"):
            review_id = parsed.path.split("/")[-1]
            if review_id in reviews_store:
                self._set_headers()
                self.wfile.write(
                    json.dumps(
                        demo_review_to_dict(reviews_store[review_id]),
                        ensure_ascii=False,
                    ).encode("utf-8")
                )
            else:
                self._set_headers(404)
                self.wfile.write(
                    json.dumps({"error": "Review not found"}, ensure_ascii=False).encode(
                        "utf-8"
                    )
                )
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "Not found"}, ensure_ascii=False).encode("utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers["Content-Length"])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode("utf-8"))

        if parsed.path == "/api/import":
            review = import_tuner_comment(
                song_name=data["song_name"],
                track_name=data["track_name"],
                comment=data["comment"],
            )
            reviews_store[review.id] = review
            self._set_headers()
            self.wfile.write(
                json.dumps(demo_review_to_dict(review), ensure_ascii=False).encode(
                    "utf-8"
                )
            )
            return

        if parsed.path.startswith("/api/reviews/") and parsed.path.endswith("/supplement"):
            review_id = parsed.path.split("/")[-2]
            if review_id in reviews_store:
                review = supplement_rehearsal_signup(
                    review=reviews_store[review_id],
                    signer=data["signer"],
                    remark=data["remark"],
                )
                reviews_store[review_id] = review
                self._set_headers()
                self.wfile.write(
                    json.dumps(demo_review_to_dict(review), ensure_ascii=False).encode(
                        "utf-8"
                    )
                )
            else:
                self._set_headers(404)
            return

        if parsed.path.startswith("/api/reviews/") and parsed.path.endswith("/manual-correct"):
            review_id = parsed.path.split("/")[-2]
            if review_id in reviews_store:
                review = manual_correct(
                    review=reviews_store[review_id],
                    why_kept=data.get("why_kept"),
                    missing_materials=data.get("missing_materials"),
                )
                reviews_store[review_id] = review
                self._set_headers()
                self.wfile.write(
                    json.dumps(demo_review_to_dict(review), ensure_ascii=False).encode(
                        "utf-8"
                    )
                )
            else:
                self._set_headers(404)
            return

        if parsed.path.startswith("/api/reviews/") and parsed.path.endswith("/rerun"):
            review_id = parsed.path.split("/")[-2]
            if review_id in reviews_store:
                review = rerun_review(reviews_store[review_id])
                reviews_store[review_id] = review
                self._set_headers()
                self.wfile.write(
                    json.dumps(demo_review_to_dict(review), ensure_ascii=False).encode(
                        "utf-8"
                    )
                )
            else:
                self._set_headers(404)
            return

        if parsed.path.startswith("/api/reviews/") and parsed.path.endswith("/complete"):
            review_id = parsed.path.split("/")[-2]
            if review_id in reviews_store:
                review = review_rework_complete(reviews_store[review_id])
                reviews_store[review_id] = review
                self._set_headers()
                self.wfile.write(
                    json.dumps(demo_review_to_dict(review), ensure_ascii=False).encode(
                        "utf-8"
                    )
                )
            else:
                self._set_headers(404)
            return

        self._set_headers(404)


def run_server(port=8000):
    server_address = ("", port)
    httpd = HTTPServer(server_address, DemoReviewHandler)
    print(f"原创歌曲 Demo 评审系统 API 已启动: http://localhost:{port}")
    print(f"看板界面: http://localhost:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    run_server()
