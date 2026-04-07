function notFound(req, res, next) {
  res.status(404);
  res.json({
    message: `Not Found - ${req.originalUrl}`,
    requestId: req.requestId
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = res.statusCode !== 200 ? res.statusCode : 500;
  const payload = {
    message: err.message || 'Server error',
    requestId: req.requestId
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };

