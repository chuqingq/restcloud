var fs = require('fs');

var express = require('express');
var session = require('express-session')
var bodyParser = require('body-parser');
var newman = require('newman');

var config = require('./package.json').config;

var Log = require('log')
  , log = new Log('debug', fs.createWriteStream('restcloud.log'));

const EMPTY_ITEM = {
    "name": "NEW FILE",
    "event": [
        {
            "listen": "test",
            "script": {
                "type": "text/javascript",
                "exec": [
                    "var jsonData = JSON.parse(responseBody);",
                    "postman.setGlobalVariable(\"sign\", jsonData.authorization);",
                    "",
                    "tests[\"Body matches authorization\"] ",
                    "= responseBody.has(\"authorization\");"
                ]
            }
        }
    ],
    "request": {
        "url": "http://testlfs.powerapp.io/push/v1/stub/aksk/sign",
        "method": "POST",
        "header": [
            {
                "key": "Content-Type",
                "value": "application/json",
                "description": ""
            }
        ],
        "body": {
            "mode": "raw",
            "raw": "{\r\n\"ak\":\"ak\",\r\n\"sk\":\"sk\",\r\n\"method\":\"POST\",\r\n\"url\":\"http://testlfs.powerapp.io/lfs/v3/cdn/_prefetch\"\r\n}"
        },
        "description": "batch send auth"
    },
    "response": []
};

const EMPTY_COLLECTION = {
    "variables": [],
    "info": {
        "name": "LFS",
        "_postman_id": "21bc3569-1f52-dd22-eeef-671dd971a9ca",
        "description": "",
        "schema": "https://schema.getpostman.com/json/collection/v2.0.0/collection.json"
    },
    "item": [
        {
            "name": "NEW FOLDER",
            "description": "",
            "item": [
                EMPTY_ITEM
            ]
        }
    ]
};

process.on('uncaughtException', function(err) {
    log.error('uncaughtException:', err);
});

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'chuqq',
    resave: false,
    saveUninitialized: false
    // cookie TODO 是否要设置maxAge
}));

// 获取user的collection，如果不存在，则返回空模板
function getUserCollection(username, callback) {
    var collectionFile = username+'_collection.json';
    fs.access(collectionFile, function(err) {
        var collection = EMPTY_COLLECTION;
        if (!err) {
            collection = JSON.parse(fs.readFileSync(collectionFile));
        }
        callback(collection);
    });
}

app.post(config.urlprefix+'/api/user/login', function(req, res) {
    log.debug('/api/user/login username: ' + req.body.username);
    log.debug('/api/user/login password: ' + req.body.password);
    // 校验用户
    for (var i = 0; i < config.user.length; i++) {
        var user = config.user[i];
        if (user.username == req.body.username) {
            if (user.password == req.body.password) {
                req.session.username = req.body.username;
            }
            break;
        }
    }
    log.debug('username: ' + req.session.username);
    if (!req.session.username) {
        res.json({ret: -1, msg: '用户名或密码无效'})
    }
    req.session.save();
    var collectionFile = req.session.username+'_collection.json';
    getUserCollection(req.session.username, function(collection) {
        res.json({
            username: req.session.username,
            collection: collection
        });
    });
});
app.post(config.urlprefix+'/api/user/logout', function(req, res) {
    log.debug('/api/user/logout username: ' + req.session.username);
    if (!req.session.username) {
        log.debug('/api/user/logout not longined');
        res.json({ret: 400, msg: 'not logined'});
        return;
    }
    req.session.username = false;
    res.json({});
});
app.get(config.urlprefix+'/api/session', function(req, res) {
    if (!req.session.username) {
        res.json({ret:-1, msg: '会话无效'});
        return
    }
    getUserCollection(req.session.username, function(collection) {
        res.json({
            username: req.session.username,
            collection: collection
        });
    });
});
// 获取数据
app.get(config.urlprefix+'/api/collection/get', function(req, res) {
    log.debug('/api/collection/get:');
    if (!req.session.username) {
        res.send({ret:-1,msg:'会话失效'})
        return;
    }
    getUserCollection(req.session.username, function(collection) {
        res.json(collection);
    });
});
// 保存所有数据
app.post(config.urlprefix+'/api/collection/saveall', function(req, res) {
    log.debug('/api/collection/saveall: ');
    // 需要Content-Type是application/json
    if (!req.session.username) {
        res.json({ret:-1,msg:'会话失效'});
        return;
    }
    var output = JSON.stringify(req.body, null, '  ');
    log.debug('output: ' + output);
    fs.writeFileSync(req.session.username+'_collection.json', output);
    res.json({});
});
// 运行一个请求
app.post(config.urlprefix+'/api/collection/run', function(req, res) {
    // 请求的body是个request，响应的body是response
    log.debug('/api/collection/run: ' + req.body.method + ' ' + req.body.name);
    if (!req.session.username) {
        res.json({ret:-1,msg:'会话失效'});
        return;
    }
    // TODO collection做成一个模板
    var collection = JSON.parse(JSON.stringify(EMPTY_COLLECTION));
    collection.item = [req.body];
    // console.log('==== collection: ' + JSON.stringify(collection, null, '  '));

    newman.run({
        collection: collection,
        reporters: 'json'
    }, function(err, res2) {
        log.debug('newman.run err: ', err, ' res: ', res2);
        if (err) {
            log.error('newman.run error: ', err); /*TODO 返回错误*/
        }
        res.send(res2.run.executions[0].response);
    });
});
app.get('/', function(req, res) {
    res.redirect(config.urlprefix);
});

// html文件
app.use(config.urlprefix, express.static('./'));

app.listen(8088);
