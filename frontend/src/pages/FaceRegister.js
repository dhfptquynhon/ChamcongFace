import React, { useContext } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import FaceRegisterModal from './FaceRegisterModal'; // Import đúng component đăng ký khuôn mặt

const FaceRegister = () => {
  const { auth, setAuth } = useContext(AuthContext);
  const navigate = useNavigate();

  if (!auth) {
    return <Navigate to="/login" />;
  }

  const handleSuccess = () => {
    // Cập nhật context để biết đã đăng ký khuôn mặt
    if (setAuth) {
      setAuth({
        ...auth,
        employee: {
          ...auth.employee,
          face_registered: true
        }
      });
    }
    // Cập nhật localStorage để đồng bộ
    const storedAuth = localStorage.getItem('auth');
    if (storedAuth) {
      const authData = JSON.parse(storedAuth);
      if (authData.employee) {
        authData.employee.face_registered = true;
        localStorage.setItem('auth', JSON.stringify(authData));
      }
    }
    alert('Cập nhật khuôn mặt thành công. Bạn có thể dùng khuôn mặt để đăng nhập lần sau.');
    navigate('/');
  };

  return (
    <FaceRegisterModal
      onClose={() => navigate('/')}
      onSuccess={handleSuccess}
    />
  );
};

export default FaceRegister;