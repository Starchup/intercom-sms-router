/* Dependencies */
const express = require('express');
const compression = require('compression');
const errorhandler = require('errorhandler');
const bodyParser = require('body-parser');
const cors = require('cors');

const config = require('./config.json');
const messages = require('./lib/messages.js');

const app = express();
app.use(cors());
app.use(bodyParser());
app.use(compression());
app.use(errorhandler());

function respond200(req, res, next)
{
    res.sendStatus(200);
}

app.post('/sms', function (req, res)
{
    if (!req.body) respond200(req, res);
    else if (!req.body.Body) respond200(req, res);
    else if (!req.body.From) respond200(req, res);
    else if (!req.body.To) respond200(req, res);
    else
    {
        messages.sms(req.body).then(function ()
        {
            respond200(req, res);
        }).catch(function (err)
        {
            console.error(JSON.stringify(err.message));
            respond200(req, res);
        });
    }
});

app.post('/intercom', function (req, res)
{
    console.log(JSON.stringify(req.body));

    if (!req.body) respond200(req, res);
    else if (!req.body.read) respond200(req, res);
    else if (!req.body.read.item) respond200(req, res);
    else if (!req.body.read.item.user) respond200(req, res);
    else if (!req.body.read.item.conversation_parts) respond200(req, res);
    else
    {
        messages.intercom(req.body.read.item).then(function ()
        {
            respond200(req, res);
        }).catch(function (err)
        {
            console.error(JSON.stringify(err.message));
            respond200(req, res);
        });
    }
});

app.use('/', respond200);

app.listen(config.port, () =>
{
    console.info(`Intercom is listening on port ${config.port}`);
});