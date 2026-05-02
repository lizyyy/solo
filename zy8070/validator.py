from datetime import datetime


class Validator:
    def __init__(self):
        self.problems = []

    def validate_segment(self, segment, products_data, banned_words):
        self.problems = []

        self._check_time_overlap(segment, products_data)

        if products_data:
            self._check_product_issues(segment, products_data)

        if banned_words and segment.get('提词卡'):
            self._check_banned_words(segment['提词卡'], banned_words)

        return self.problems

    def _check_time_overlap(self, segment, all_products):
        start = segment.get('开始时间')
        end = segment.get('结束时间')

        if not start or not end:
            self.problems.append("时间格式错误或缺失")
            return

        try:
            start_dt = datetime.strptime(start, "%H:%M:%S")
            end_dt = datetime.strptime(end, "%H:%M:%S")

            if end_dt <= start_dt:
                self.problems.append("结束时间早于或等于开始时间")

        except ValueError:
            self.problems.append("时间解析错误")

    def _check_product_issues(self, segment, all_products):
        segment_id = segment.get('id')
        segment_name = segment.get('环节名称')

        related_products = [
            p for p in all_products
            if str(p.get('环节ID', '')) == str(segment_id)
            or p.get('环节名称', '') == segment_name
        ]

        for prod in related_products:
            if not prod.get('图片路径'):
                self.problems.append(f"商品「{prod.get('商品名称', '未知')}」缺图")

            if not prod.get('优惠价') or str(prod.get('优惠价', '')).strip() == '':
                self.problems.append(f"商品「{prod.get('商品名称', '未知')}」优惠价缺失")

            script = prod.get('口播脚本', '')
            if script:
                self._check_banned_words(script, [])

    def _check_banned_words(self, text, banned_words):
        if not banned_words:
            return

        text_lower = text.lower()
        for word in banned_words:
            if word.lower() in text_lower:
                self.problems.append(f"口播踩禁用词:「{word}」")