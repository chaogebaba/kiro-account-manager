# 本地嵌入模型

目录：`packages/kiro-shared/dist/all-MiniLM-L6-v2/`

## 模型信息

- 名称：all-MiniLM-L6-v2
- 类型：Sentence Transformer
- 用途：文本嵌入（Text Embedding）
- 维度：384 维向量
- 格式：ONNX（用于本地推理）

## 文件结构

```
all-MiniLM-L6-v2/
├── config.json          # 模型配置
├── tokenizer.json       # 分词器配置
├── tokenizer_config.json
├── special_tokens_map.json
├── vocab.txt            # 词汇表
└── onnx/
    └── model_quantized.onnx  # 量化后的 ONNX 模型
```

## 用途

Kiro IDE 使用此模型进行代码库语义搜索：

1. 将代码/文档转换为向量
2. 存储到本地向量数据库
3. 用户搜索时，将查询转换为向量
4. 计算余弦相似度，返回最相关结果

## 工作流程

```
用户输入 → 分词 → 模型推理 → 384维向量 → 相似度搜索 → 返回结果
```

## 优势

- 本地运行，无需网络
- 隐私安全，代码不上传
- 响应快速，毫秒级
- 模型小巧（~23MB 量化后）

## 技术细节

- 使用 ONNX Runtime 进行推理
- 量化模型减少内存占用
- 支持批量处理提高效率
