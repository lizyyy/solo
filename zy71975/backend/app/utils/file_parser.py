import os
import csv
from typing import Dict, List, Any
from pathlib import Path

from app.core.exceptions import FileParseException
from app.core.config import settings


def parse_file(file_path: str) -> str:
    if not os.path.exists(file_path):
        raise FileParseException(
            filename=os.path.basename(file_path),
            message="File not found",
            user_friendly_message="找不到这个文件哦，看看是不是文件名记错了？"
        )

    file_ext = Path(file_path).suffix.lower()

    if file_ext == ".txt":
        return _parse_txt(file_path)
    elif file_ext == ".md":
        return _parse_md(file_path)
    elif file_ext == ".csv":
        return _parse_csv(file_path)
    else:
        raise FileParseException(
            filename=os.path.basename(file_path),
            message=f"Unsupported file type: {file_ext}",
            user_friendly_message=f"不支持的文件格式 {file_ext}，只支持 txt、md、csv 哦～"
        )


def _parse_txt(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return content.strip()
    except UnicodeDecodeError:
        try:
            with open(file_path, "r", encoding="gbk") as f:
                content = f.read()
            return content.strip()
        except Exception as e:
            raise FileParseException(
                filename=os.path.basename(file_path),
                message=f"Failed to decode file: {str(e)}",
                user_friendly_message="文件编码有问题，试试转成 UTF-8 格式？"
            )
    except Exception as e:
        raise FileParseException(
            filename=os.path.basename(file_path),
            message=f"Failed to read txt file: {str(e)}"
        )


def _parse_md(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return content.strip()
    except UnicodeDecodeError:
        try:
            with open(file_path, "r", encoding="gbk") as f:
                content = f.read()
            return content.strip()
        except Exception as e:
            raise FileParseException(
                filename=os.path.basename(file_path),
                message=f"Failed to decode file: {str(e)}",
                user_friendly_message="文件编码有问题，试试转成 UTF-8 格式？"
            )
    except Exception as e:
        raise FileParseException(
            filename=os.path.basename(file_path),
            message=f"Failed to read md file: {str(e)}"
        )


def _parse_csv(file_path: str) -> str:
    try:
        rows = []
        with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            for row in reader:
                rows.append(" | ".join(cell.strip() for cell in row))
        return "\n".join(rows)
    except UnicodeDecodeError:
        try:
            rows = []
            with open(file_path, "r", encoding="gbk", newline="") as f:
                reader = csv.reader(f)
                for row in reader:
                    rows.append(" | ".join(cell.strip() for cell in row))
            return "\n".join(rows)
        except Exception as e:
            raise FileParseException(
                filename=os.path.basename(file_path),
                message=f"Failed to decode file: {str(e)}",
                user_friendly_message="文件编码有问题，试试转成 UTF-8 格式？"
            )
    except Exception as e:
        raise FileParseException(
            filename=os.path.basename(file_path),
            message=f"Failed to read csv file: {str(e)}"
        )


def parse_csv_to_dict(file_path: str) -> List[Dict[str, Any]]:
    try:
        results = []
        with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                results.append({k: v.strip() for k, v in row.items()})
        return results
    except UnicodeDecodeError:
        try:
            results = []
            with open(file_path, "r", encoding="gbk", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    results.append({k: v.strip() for k, v in row.items()})
            return results
        except Exception as e:
            raise FileParseException(
                filename=os.path.basename(file_path),
                message=f"Failed to decode file: {str(e)}",
                user_friendly_message="文件编码有问题，试试转成 UTF-8 格式？"
            )
    except Exception as e:
        raise FileParseException(
            filename=os.path.basename(file_path),
            message=f"Failed to parse csv to dict: {str(e)}"
        )


def save_uploaded_file(file_content: bytes, filename: str, meeting_no: str) -> str:
    file_ext = Path(filename).suffix.lower()
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise FileParseException(
            filename=filename,
            message=f"Unsupported file type: {file_ext}",
            user_friendly_message=f"不支持的文件格式 {file_ext}，只支持 txt、md、csv 哦～"
        )

    upload_dir = Path(settings.UPLOAD_DIR) / meeting_no
    upload_dir.mkdir(parents=True, exist_ok=True)

    save_path = upload_dir / filename
    with open(save_path, "wb") as f:
        f.write(file_content)

    return str(save_path)


def extract_qa_pairs(content: str) -> List[Dict[str, str]]:
    qa_pairs = []
    lines = content.split("\n")
    current_question = ""
    current_answer = ""
    is_answer = False

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.endswith("?") or line.endswith("？") or line.startswith("Q:") or line.startswith("Q：") or line.startswith("问题"):
            if current_question and current_answer:
                qa_pairs.append({
                    "question": current_question,
                    "answer": current_answer.strip()
                })
            current_question = line.replace("Q:", "").replace("Q：", "").replace("问题：", "").replace("问题:", "").strip()
            current_answer = ""
            is_answer = True
        elif line.startswith("A:") or line.startswith("A：") or line.startswith("回答") or line.startswith("答案"):
            current_answer += line.replace("A:", "").replace("A：", "").replace("回答：", "").replace("回答:", "").replace("答案：", "").replace("答案:", "").strip() + " "
            is_answer = True
        elif is_answer:
            current_answer += line + " "

    if current_question and current_answer:
        qa_pairs.append({
            "question": current_question,
            "answer": current_answer.strip()
        })

    if not qa_pairs:
        qa_pairs.append({
            "question": "会议内容",
            "answer": content.strip()
        })

    return qa_pairs
