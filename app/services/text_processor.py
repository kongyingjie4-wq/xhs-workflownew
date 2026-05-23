import re
import jieba
from collections import Counter

STOP_WORDS = {
    "的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一", "一个",
    "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
    "自己", "这", "他", "她", "它", "们", "那", "吗", "吧", "啊", "呢", "哈", "呀",
    "哦", "嗯", "么", "什么", "怎么", "为什么", "可以", "不", "没", "还", "但", "而",
    "且", "或", "如果", "因为", "所以", "虽然", "但是", "如果", "就", "也", "都",
    "R", "r", "http", "https", "www", "com", "cn", "html", "htm", "jpg", "png",
}

TOPIC_KEYWORDS = {
    "追奶方法": ["追奶", "奶量", "追奶方法", "下奶", "催奶", "奶水", "奶少", "追"],
    "母乳喂养": ["母乳", "亲喂", "瓶喂", "纯母乳", "喂母乳", "母乳喂养"],
    "奶粉喂养": ["奶粉", "混合喂养", "配方奶", "奶瓶", "冲奶粉"],
    "堵奶问题": ["堵奶", "硬块", "小白点", "小白泡", "乳腺炎", "堵", "硬"],
    "乳头问题": ["乳头", "皲裂", "疼痛", "乳头皲裂", "乳头疼", "破", "裂"],
    "宝宝吃奶": ["宝宝", "吃奶", "吸奶", "吮吸", "吃", "吸", "睡着", "哭"],
    "吸奶器": ["吸奶器", "吸奶", "电动吸奶器", "手动吸奶器"],
    "月子护理": ["月子", "月嫂", "产后", "坐月子", "剖腹产", "顺产"],
    "断奶": ["断奶", "离乳", "断夜奶", "自然离乳"],
    "乳房护理": ["乳房", "乳腺", "通乳", "开奶", "涨奶", "漏奶"],
}


def clean_text(text: str) -> str:
    text = re.sub(r"http[s]?://\S+", "", text)
    text = re.sub(r"\[.*?R\]", "", text)
    text = re.sub(r"[a-zA-Z0-9]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_words(text: str) -> list[str]:
    words = jieba.lcut(text)
    return [w for w in words if len(w) >= 2 and w not in STOP_WORDS]


def count_word_freq(contents: list[str], top_n: int = 50) -> dict[str, int]:
    all_words = []
    for content in contents:
        cleaned = clean_text(content)
        words = extract_words(cleaned)
        all_words.extend(words)
    counter = Counter(all_words)
    return dict(counter.most_common(top_n))


def cluster_topics(contents: list[str]) -> dict[str, list[str]]:
    topic_comments = {topic: [] for topic in TOPIC_KEYWORDS}
    for content in contents:
        cleaned = clean_text(content)
        for topic, keywords in TOPIC_KEYWORDS.items():
            if any(kw in cleaned for kw in keywords):
                if len(topic_comments[topic]) < 20:
                    topic_comments[topic].append(content)
    return {k: v for k, v in topic_comments.items() if v}


def process_contents(contents: list[str]) -> dict:
    word_freq = count_word_freq(contents)
    topic_clusters = cluster_topics(contents)
    return {
        "word_freq": word_freq,
        "topic_clusters": topic_clusters,
    }
