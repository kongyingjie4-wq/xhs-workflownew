import json
import sys

def extract_content(file_path):
    contents = []
    with open(file_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if "content" in data and data["content"]:
                    contents.append(data["content"])
            except json.JSONDecodeError:
                print(f"第 {i} 行 JSON 解析失败，已跳过")
    return contents

if __name__ == "__main__":
    file_path = sys.argv[1] if len(sys.argv) > 1 else "creator_comments_2026-03-19.jsonl"
    contents = extract_content(file_path)
    output_file = "extracted_contents.txt"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"共提取 {len(contents)} 条内容\n\n")
        f.write("=" * 50 + "\n")
        for i, c in enumerate(contents, 1):
            f.write(f"[{i}] {c}\n")
            f.write("-" * 50 + "\n")
    print(f"完成！共提取 {len(contents)} 条内容，已保存到 {output_file}")
