// 1. 先设置支持跨域
// 2. 拼接一个collection.json，用newman.run(json, {reporter: 'json'})来获取结果，并返回
// 去掉对json-server的依赖，自己读写文件

var fs = require('fs');

var express = require('express');
var session = require('express-session')
var bodyParser = require('body-parser');
var newman = require('newman');

var config = require('./package.json').config;

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'chuqq',
    resave: false,
    saveUninitialized: false
    // cookie TODO 是否要设置maxAge
}));

app.post('/api/user/login', function(req, res) {
    console.log('/api/user/login username: ' + req.body.username);
    console.log('/api/user/login password: ' + req.body.password);
    // 校验用户
    for (var i = 0; i < config.user.length; i++) {
        var user = config.user[i];
        if (user.username == req.body.username) {
            if (user.password == req.body.password) {
                req.session.username = req.body.username;
                break;
            }
            else {
                break;
            }
        }
    }
    console.log('username: ' + req.session.username);
    if (req.session.username) {
        req.session.save();
        res.json({
            username: req.session.username,
            collection: JSON.parse(fs.readFileSync(req.session.username+'_collection.json'))
        });
    } else {
        res.json({ret: -1, msg: '用户名或密码无效'})
    }
});
app.post('/api/user/logout', function(req, res) {
    console.log('/api/user/logout username: ' + req.session.username);
    if (!req.session.username) {
        console.log('/api/user/logout not longined');
        res.json({ret: 400, msg: 'not logined'});
        return;
    }
    req.session.username = false;
    res.json({});
});
app.get('/api/session', function(req, res) {
    if (req.session.username) {
        res.json({
            username: req.session.username,
            collection: JSON.parse(fs.readFileSync(req.session.username+'_collection.json'))
        });
    }
    else {
        res.json({ret:-1, msg: '会话无效'});
    }
});
// 获取数据
app.get('/api/collection/get', function(req, res) {
    console.log('/api/collection/get:');
    if (!req.session.username) {
        res.send({ret:-1,msg:'会话失效'})
        return;
    }
    var content = fs.readFileSync(req.session.username + '_collection.json');
    // TODO 如果文件不存在，则回复一个空的模板
    res.send(content);
});
// 保存所有数据
app.post('/api/collection/saveall', function(req, res) {
    console.log('/api/collection/saveall: ');
    // 需要Content-Type是application/json
    if (!req.session.username) {
        res.json({ret:-1,msg:'会话失效'});
        return;
    }
    var output = JSON.stringify(req.body, null, '  ');
    console.log('output: ' + output);
    fs.writeFileSync(req.session.username+'_collection.json', output);
    res.json({});
});
// 运行一个请求
app.post('/api/collection/run', function(req, res) {
    // 请求的body是个request，响应的body是response
    console.log('/api/collection/run: ' + req.body.method + ' ' + req.body.name);
    // TODO collection做成一个模板
    var collection = {
        "variables": [],
        "info": {
            "name": "LFS",
            "_postman_id": "21bc3569-1f52-dd22-eeef-671dd971a9ca",
            "description": "",
            "schema": "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"
        },
        "item": []
    };
    collection.item = [req.body];
    // console.log('==== collection: ' + JSON.stringify(collection, null, '  '));

    newman.run({
        collection: collection,
        reporters: 'json'
    }, function(err, res2) {
        console.log('newman.run err: ', err, ' res: ', res2);
        if (err) {
            console.log('newman.run error: ', err); /*TODO 返回错误*/
        }
        res.send(res2.run.executions[0].response);
    });
});
// html文件
app.use(express.static('./'));

app.listen(8088);
