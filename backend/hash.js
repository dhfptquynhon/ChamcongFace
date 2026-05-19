const bcrypt = require('bcryptjs');

const password = 'Abcd@1234';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Lỗi:', err);
    return;
  }
  console.log('Hash cho mật khẩu "' + password + '":');
  console.log(hash);
});