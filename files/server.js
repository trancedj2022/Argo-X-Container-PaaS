const username = process.env.WEB_USERNAME || "admin";
const password = process.env.WEB_PASSWORD || "password";
const port = process.env.PORT || 3000;
const express = require("express");
const app = express();
const exec = require("child_process").exec;
const os = require("os");
const { legacyCreateProxyMiddleware } = require("http-proxy-middleware");
const auth = require("basic-auth");

app.get("/", function (req, res) {
  res.status(200).send("hello world");
});

// 基本身份验证中间件
app.use((req, res, next) => {
  const user = auth(req);
  if (user && user.name === username && user.pass === password) {
    return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Node"');
  return res.status(401).send();
});

// 执行命令的路由
app.get("/status", executeCommand("pm2 list; ps -ef"));
app.get("/listen", executeCommand("ss -nltp"));
app.get("/list", executeCommand("bash argo.sh"));
app.get("/info", (req, res) => {
  exec("cat /etc/*release | grep -E ^NAME", (err, stdout) => {
    if (err) {
      return res.send("命令行执行错误：" + err);
    }
    res.send(`命令行执行结果：\nLinux System: ${stdout}\nRAM: ${os.totalmem() / 1000 / 1000} MB`);
  });
});
app.get("/test", (req, res) => {
  exec('mount | grep " / " | grep "(ro," >/dev/null', (error) => {
    if (error) {
      res.send("系统权限为---非只读");
    } else {
      res.send("系统权限为---只读");
    }
  });
});

// 保活函数
function keepWebAlive() {
  exec(`curl -m8 127.0.0.1:${port}`, (err, stdout) => {
    if (err) {
      console.log("保活-请求主页-命令行执行错误：" + err);
    } else {
      console.log("保活-请求主页-命令行执行成功，响应报文:" + stdout);
    }
  });
}
setInterval(keepWebAlive, 10 * 1000);

// 代理中间件
app.use(
  legacyCreateProxyMiddleware({
    target: 'http://127.0.0.1:8080/', // 需要跨域处理的请求地址
    ws: true, // 是否代理 WebSocket
    changeOrigin: true, // 是否改变原始主机头为目标 URL
    pathFilter: '/', // 使用 pathFilter 替代 context
    on: {
      proxyRes: function (proxyRes, req, res) {
        // 处理代理响应
      },
      proxyReq: function (proxyReq, req, res) {
        // 处理代理请求
      },
      error: function (err, req, res) {
        console.warn('WebSocket error:', err);
      }
    },
    logger: console, // 启用日志记录
  })
);

// 执行核心脚本
exec("bash entrypoint.sh", (err, stdout) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(stdout);
});

// 启动服务
app.listen(port, () => console.log(`示例应用正在监听端口 ${port}！`));

// 执行命令的辅助函数
function executeCommand(cmd) {
  return (req, res) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        return res.type("html").send(`<pre>命令行执行错误：\n${err}</pre>`);
      }
      res.type("html").send(`<pre>${stdout}</pre>`);
    });
  };
}
