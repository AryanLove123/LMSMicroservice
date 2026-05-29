const wrapHtml = (title, body) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body{
            font-family:Arial,sans-serif;
            color:#333;
            max-width:600px;
            margin:0 auto;
            padding:20px
          }

          h2{
            color:#2c3e50;
            border-bottom:2px solid #3498db;
            padding-bottom:10px
          }

          .footer{
            margin-top:30px;
            font-size:12px;
            color:#999;
            border-top:1px solid #eee;
            padding-top:10px
          }
        </style>
      </head>

      <body>
        <h2>${title}</h2>
        ${body}
        <div class="footer">
          <p>
            Leave Management Portal — This is an automated notification.
          </p>
        </div>
      </body>
    </html>
  `;
};

module.exports = { wrapHtml };
