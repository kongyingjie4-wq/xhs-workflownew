import re
import jieba
from collections import Counter

# 扩充停用词列表 - 过滤掉无意义的常用词
STOP_WORDS = {
    # 代词
    "我", "你", "他", "她", "它", "我们", "你们", "他们", "自己", "人家", "大家",
    # 动词
    "是", "有", "在", "会", "要", "去", "来", "到", "说", "看", "做", "给", "让",
    "想", "能", "可以", "应该", "需要", "可能", "觉得", "感觉", "知道", "请", "求",
    # 形容词
    "好", "大", "小", "多", "少", "快", "慢", "新", "旧", "高", "低",
    # 副词
    "很", "太", "非常", "特别", "比较", "最", "更", "还", "也", "都", "就", "才",
    "先", "再", "又", "已", "已经", "一直", "总是", "经常", "有时", "偶尔",
    # 连词
    "和", "与", "或", "或者", "但是", "但", "然而", "不过", "可是", "因为", "所以",
    "如果", "虽然", "尽管", "既然", "无论", "不管",
    # 介词
    "在", "从", "到", "向", "往", "对于", "关于", "至于", "通过", "经过", "按照",
    # 量词
    "个", "些", "点", "下", "次", "遍", "趟", "回", "番",
    # 疑问词
    "什么", "怎么", "哪", "哪里", "哪个", "为什么", "多少", "几", "吗", "呢", "吧",
    "啊", "呀", "哦", "嗯", "哈", "啦", "嘛", "呗",
    # 其他常用词
    "这", "那", "这个", "那个", "这里", "那里", "这样", "那样", "怎么", "怎么样",
    "现在", "今天", "昨天", "明天", "最近", "以前", "以后", "当时", "时候",
    "宝宝", "孩子", "小孩", "宝贝", "娃", "小宝", "大宝",
    "老师", "医生", "护士", "月嫂", "家人", "老公", "老婆", "婆婆", "妈妈",
    "爸爸", "爷爷", "奶奶", "姥姥", "姥爷",
    "一下", "一会儿", "一点", "一些", "很多", "非常", "特别", "比较",
    "我家", "你家", "他家", "大家", "咱们", "各位", "亲", "亲爱的",
    "小时", "分钟", "天", "周", "月", "年", "早上", "中午", "晚上",
    "请问", "咨询", "求助", "求助", "感谢", "谢谢", "不谢", "客气",
    "就是", "真是", "确实", "的确", "当然", "肯定", "一定", "必须",
    "思", "我思", "你思", "私", "私信", "回", "回复", "消息",
    # 标点和符号
    "R", "r", "http", "https", "www", "com", "cn", "html", "htm", "jpg", "png",
}

# 母婴领域痛点关键词词典
PAIN_POINT_KEYWORDS = {
    # 追奶相关
    "追奶": "追奶",
    "奶量不足": "奶量不足",
    "奶少": "奶少",
    "下奶": "下奶",
    "催奶": "催奶",
    "奶水少": "奶水少",
    "奶水不够": "奶水不够",
    "没奶": "没奶",
    "回奶": "回奶",
    "奶量": "奶量",
    # 喂养方式
    "母乳": "母乳喂养",
    "亲喂": "亲喂",
    "瓶喂": "瓶喂",
    "纯母乳": "纯母乳",
    "混合喂养": "混合喂养",
    "奶粉": "奶粉",
    "配方奶": "配方奶",
    # 堵奶相关
    "堵奶": "堵奶",
    "硬块": "乳房硬块",
    "小白点": "乳头小白点",
    "小白泡": "乳头小白泡",
    "乳腺炎": "乳腺炎",
    "涨奶": "涨奶",
    "奶结": "奶结",
    "堵": "堵塞",
    # 乳头问题
    "乳头皲裂": "乳头皲裂",
    "乳头疼": "乳头疼痛",
    "乳头破": "乳头破损",
    "皲裂": "皲裂",
    "破": "破损",
    "裂": "开裂",
    "疼痛": "疼痛",
    "疼": "疼痛",
    "痛": "疼痛",
    # 宝宝吃奶问题
    "睡着": "吃奶睡着",
    "不吃": "拒奶",
    "拒绝": "拒奶",
    "不吸": "不吸奶",
    "哭": "哭闹",
    "呛奶": "呛奶",
    "吐奶": "吐奶",
    "溢奶": "溢奶",
    # 吸奶器
    "吸奶器": "吸奶器",
    "吸奶": "吸奶",
    # 月子相关
    "月子": "月子护理",
    "产后": "产后恢复",
    "剖腹产": "剖腹产",
    "顺产": "顺产",
    # 断奶相关
    "断奶": "断奶",
    "离乳": "离乳",
    "断夜奶": "断夜奶",
    # 乳房护理
    "乳房": "乳房护理",
    "乳腺": "乳腺",
    "通乳": "通乳",
    "开奶": "开奶",
    "漏奶": "漏奶",
    # 其他痛点
    "气血不足": "气血不足",
    "贫血": "贫血",
    "湿疹": "湿疹",
    "黄疸": "黄疸",
    "积食": "积食",
    "便秘": "便秘",
    "腹泻": "腹泻",
    "发烧": "发烧",
    "感冒": "感冒",
}


def clean_text(text: str) -> str:
    """清洗文本，去除无意义内容"""
    text = re.sub(r"http[s]?://\S+", "", text)
    text = re.sub(r"\[.*?R\]", "", text)
    text = re.sub(r"[a-zA-Z0-9]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_pain_points(text: str) -> list[str]:
    """提取痛点关键词"""
    pain_points = []
    for keyword, category in PAIN_POINT_KEYWORDS.items():
        if keyword in text:
            pain_points.append(category)
    return pain_points


def extract_words(text: str) -> list[str]:
    """提取有意义的词汇"""
    words = jieba.lcut(text)
    return [w for w in words if len(w) >= 2 and w not in STOP_WORDS]


def count_word_freq(contents: list[str], top_n: int = 50) -> dict[str, int]:
    """统计痛点关键词频率"""
    all_pain_points = []
    for content in contents:
        cleaned = clean_text(content)
        pain_points = extract_pain_points(cleaned)
        all_pain_points.extend(pain_points)

    counter = Counter(all_pain_points)
    return dict(counter.most_common(top_n))


def get_word_comments(contents: list[str]) -> dict[str, list[str]]:
    """获取每个关键词对应的评论"""
    word_comments = {}
    for content in contents:
        cleaned = clean_text(content)
        pain_points = extract_pain_points(cleaned)
        # 去重，避免同一个评论被添加多次
        for point in set(pain_points):
            if point not in word_comments:
                word_comments[point] = []
            if len(word_comments[point]) < 20:  # 每个关键词最多20条评论
                word_comments[point].append(content)
    return word_comments


def cluster_topics(contents: list[str]) -> dict[str, list[str]]:
    """按主题聚类评论"""
    # 定义主题和对应的关键词
    TOPIC_KEYWORDS = {
        "追奶方法": ["追奶", "奶量", "奶少", "下奶", "催奶", "奶水", "没奶", "回奶"],
        "母乳喂养": ["母乳", "亲喂", "瓶喂", "纯母乳", "喂母乳"],
        "奶粉喂养": ["奶粉", "混合喂养", "配方奶", "奶瓶"],
        "堵奶问题": ["堵奶", "硬块", "小白点", "小白泡", "乳腺炎", "涨奶", "奶结"],
        "乳头问题": ["乳头", "皲裂", "疼痛", "破", "裂", "疼", "痛"],
        "宝宝吃奶": ["吃奶", "吸奶", "睡着", "不吃", "拒绝", "不吸", "哭", "呛奶", "吐奶"],
        "吸奶器": ["吸奶器", "吸奶"],
        "月子护理": ["月子", "产后", "剖腹产", "顺产"],
        "断奶": ["断奶", "离乳", "断夜奶"],
        "乳房护理": ["乳房", "乳腺", "通乳", "开奶", "漏奶"],
    }

    topic_comments = {topic: [] for topic in TOPIC_KEYWORDS}
    for content in contents:
        cleaned = clean_text(content)
        for topic, keywords in TOPIC_KEYWORDS.items():
            if any(kw in cleaned for kw in keywords):
                if len(topic_comments[topic]) < 20:
                    topic_comments[topic].append(content)
    return {k: v for k, v in topic_comments.items() if v}


def process_contents(contents: list[str]) -> dict:
    """处理内容，提取词频和主题聚类"""
    word_freq = count_word_freq(contents)
    word_comments = get_word_comments(contents)
    topic_clusters = cluster_topics(contents)
    return {
        "word_freq": word_freq,
        "word_comments": word_comments,
        "topic_clusters": topic_clusters,
    }


def auto_select_topics(word_freq: dict[str, int]) -> list[str]:
    """自动选择主题：从高频词中随机选择 1-3 个"""
    import random
    if not word_freq:
        return []

    # 获取所有高频词
    topics = list(word_freq.keys())

    # 随机选择 1-3 个主题
    count = min(random.randint(1, 3), len(topics))
    selected = random.sample(topics, count)

    return selected


def auto_select_route() -> str:
    """自动选择文案类型：随机选择纯科普或营销"""
    import random
    return random.choice(["KIND_REMINDER", "MARKETING"])
