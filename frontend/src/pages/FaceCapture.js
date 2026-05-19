import React, { useRef, useState, useCallback } from 'react';
import { Button, Box, Avatar, Typography, IconButton } from '@mui/material';
import { CameraAlt as CameraIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import Webcam from 'react-webcam';

const FaceCapture = ({ onImageCapture, initialImage }) => {
  const webcamRef = useRef(null);
  const [image, setImage] = useState(initialImage || null);
  const [showWebcam, setShowWebcam] = useState(!initialImage);

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setImage(imageSrc);
      setShowWebcam(false);
      onImageCapture(imageSrc);
    }
  }, [onImageCapture]);

  const retake = () => {
    setImage(null);
    setShowWebcam(true);
    onImageCapture(null);
  };

  return (
    <Box sx={{ textAlign: 'center', mt: 2 }}>
      {showWebcam ? (
        <>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width="100%"
            height="auto"
            videoConstraints={{ facingMode: 'user' }}
            style={{ borderRadius: 8, maxHeight: 240, objectFit: 'cover' }}
          />
          <Button
            variant="contained"
            startIcon={<CameraIcon />}
            onClick={capture}
            sx={{ mt: 1 }}
            size="small"
          >
            Chụp ảnh
          </Button>
        </>
      ) : (
        <Box>
          <Avatar
            src={image}
            variant="rounded"
            sx={{ width: '100%', height: 'auto', maxHeight: 200, borderRadius: 2 }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={retake}
            sx={{ mt: 1 }}
            size="small"
          >
            Chụp lại
          </Button>
        </Box>
      )}
      {!showWebcam && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Ảnh đã chụp sẽ được dùng để nhận diện khuôn mặt.
        </Typography>
      )}
    </Box>
  );
};

export default FaceCapture;