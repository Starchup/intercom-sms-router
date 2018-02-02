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

function respondTwilio(req, res, next)
{
    res.status(200).send('<Response></Response>');
}

app.post('/sms', function (req, res)
{
    if (req.body &&
        req.body.Body &&
        req.body.From)
    {
        messages.sms(req.body).catch(function (err)
        {
            console.error(JSON.stringify(err));
        });
    }
    respondTwilio(req, res);
});

app.post('/intercom', function (req, res)
{
    if (req.body &&
        req.body.data &&
        req.body.data.item &&
        req.body.data.item.user &&
        req.body.data.item.conversation_parts)
    {
        messages.intercom(req.body.data.item).catch(function (err)
        {
            console.error(JSON.stringify(err));
        });
    }

    respond200(req, res);
});

app.use('/', respond200);

app.listen(config.port, () =>
{
    console.info(`Intercom is listening on port ${config.port}`);
});