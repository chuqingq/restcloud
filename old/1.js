var fs = require('fs');

var b = fs.readFileSync('./mail.qq.com1.har.json');
var input = JSON.parse(b.toString()).log.entries;
b = fs.readFileSync('./mail.qq.com2.har.json');
input = input.concat(JSON.parse(b.toString()).log.entries);

console.log('input count: ', input.length);

// 结构化的请求
var output = [];

for (var i in input) {
    var req = input[i];
    // console.log('req: ', req);

    var referer = getRefererFromHeaders(req.request.headers);
    if (!referer) {
        output.push(req);
        continue;
    }
    var parent = getReqByUrl(referer, output);
    if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(req);
    } else {
        console.log('WARN referer not found: ', referfer);
        // output.push(req);
    }
}

console.log('output: ', output.length);

function getRefererFromHeaders(headers) {
    for (var i in headers) {
        var h = headers[i];
        if (h.name == 'referer' || h.name == 'Referer') {
            // console.log('referer: ', h.value);
            return h.value;
        }
    }
    return null;
}

function getReqByUrl(url, children) {
    for (var i in children) {
        var req = children[i];
        if (url == req.request.url) {
            return req;
        }
        if (req.children) {
            req = getReqByUrl(url, req.children);
            if (req) {
                return req;
            }
        }
    }
    return null;
}


function print(indent, reqs) {
    for (var i in reqs) {
        var req = reqs[i];
        console.log(indent, req.request.method, req.request.url);
        if (req.children) print(indent+' ', req.children);
    }
}

print('', output);


// 保存文件
fs.writeFileSync('1.json', JSON.stringify(output));

// 全部打印