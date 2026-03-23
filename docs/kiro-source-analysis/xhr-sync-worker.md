# 同步 XHR Worker

文件：`dist/xhr-sync-worker.js`

## 用途

在 Node.js 环境中模拟浏览器的同步 XMLHttpRequest，用于某些需要同步 HTTP 请求的场景。

## 实现原理

使用 JSDOM 库创建虚拟 DOM 环境，通过 Worker 线程实现同步阻塞：

```javascript
const { JSDOM } = require('jsdom');

// 创建虚拟 DOM
const dom = new JSDOM('', { 
  runScripts: 'dangerously',
  resources: 'usable'
});

// 使用 JSDOM 的 XMLHttpRequest
const xhr = new dom.window.XMLHttpRequest();
xhr.open('GET', url, false);  // false = 同步
xhr.send();
```

## 工作流程

1. 主线程发送请求参数到 Worker
2. Worker 使用 JSDOM 的 XMLHttpRequest 发起同步请求
3. 请求完成后返回结果给主线程
4. 主线程阻塞等待结果

## 使用场景

- 某些遗留代码需要同步 HTTP 请求
- 初始化阶段必须同步获取配置
- 与不支持 async/await 的代码集成

## 注意事项

- 同步请求会阻塞线程，影响性能
- 仅用于必要场景，优先使用异步请求
- 生产环境应避免使用
