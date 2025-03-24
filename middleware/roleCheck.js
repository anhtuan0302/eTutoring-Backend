const roleCheck = (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).send({ error: 'Vui lòng xác thực.' });
      }
      
      if (!roles.includes(req.user.role)) {
        return res.status(403).send({ error: 'Không có quyền truy cập.' });
      }
      
      next();
    };
  };
  
  module.exports = roleCheck;