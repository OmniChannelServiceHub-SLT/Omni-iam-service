const buckets = new Map();
const timer = setInterval(() => { const now = Date.now(); for (const [k,v] of buckets) if (v.until <= now) buckets.delete(k); }, 60000);
timer.unref();
module.exports = function rateLimit(req, res, next) {
  const key = req.ip; const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.until <= now) { bucket = { count: 0, until: now + 60000 }; buckets.set(key, bucket); }
  if (++bucket.count > 40) { res.set('Retry-After', String(Math.ceil((bucket.until-now)/1000))); return res.status(429).json({ isSuccess: false, errorCode: 'RATE_LIMIT', errorMessege: 'Too many requests.', dataBundle: null, exceptionDetail: null, errorShow: 'Too many requests.' }); }
  next();
};
