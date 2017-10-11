/* Dependencies */
const express = require('express');
const compression = require('compression');
const errorhandler = require('errorhandler');
const bodyParser = require('body-parser');
const cors = require('cors');

const config = require('./config.json');
const sms = require('./lib/sms.js');

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
        sms.receive(req.body).then(respond200).catch(function (err)
        {
            res.status(400).send(JSON.stringify(err.message));
        });
    }
});

app.use('/', respond200);

app.listen(config.port, () =>
{
    console.info(`Intercom is listening on port ${config.port}`);
});