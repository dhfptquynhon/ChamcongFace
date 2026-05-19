import React, { useState, useEffect, useRef } from "react";

const AnalogClock = () => {
  const clockRef = useRef(null);

  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("digitalClockPosition");
    return saved ? JSON.parse(saved) : { top: 20, right: 20 };
  });

  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = () => {
    return time.toLocaleTimeString("vi-VN");
  };

  const formatDate = () => {
    return time.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleMouseDown = (e) => {
    const rect = clockRef.current.getBoundingClientRect();

    setOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    setDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;

    const parentRect =
      clockRef.current.parentElement.getBoundingClientRect();

    const newLeft = e.clientX - offset.x - parentRect.left;
    const newTop = e.clientY - offset.y - parentRect.top;

    setPosition({
      top: Math.max(
        0,
        Math.min(newTop, parentRect.height - clockRef.current.offsetHeight)
      ),
      left: Math.max(
        0,
        Math.min(newLeft, parentRect.width - clockRef.current.offsetWidth)
      ),
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    localStorage.setItem(
      "digitalClockPosition",
      JSON.stringify(position)
    );
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, offset, position]);

  return (
    <div
  ref={clockRef}
  onMouseDown={handleMouseDown}
  style={{
    position: "fixed",
    top: "55px",
    right: "30px",
    zIndex: 1300,
    cursor: "default",
    userSelect: "none",
    minWidth: "110px", // thu nhỏ lại

    // Hiệu ứng kính mờ (glassmorphism)
    background: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(10px) saturate(160%)",
    WebkitBackdropFilter: "blur(10px) saturate(160%)",
    border: "1px solid rgba(255, 255, 255, 0.5)",
    borderRadius: "30px", // bo tròn vừa phải
    padding: "6px 16px", // padding nhỏ hơn

    // Đổ bóng nhẹ, tạo chiều sâu
    boxShadow: "0 10px 25px -8px rgba(0, 100, 80, 0.25), 0 3px 8px rgba(0, 0, 0, 0.05), inset 0 1px 2px rgba(255,255,255,0.6)",

    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    textAlign: "center",

    // Hiệu ứng chuyển động mượt mà
    transition: "transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.1), box-shadow 0.3s ease, background 0.3s ease",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.02)";
    e.currentTarget.style.boxShadow = "0 18px 35px -10px rgba(0, 130, 110, 0.35), 0 5px 15px rgba(0, 0, 0, 0.1), inset 0 1px 3px rgba(255,255,255,0.8)";
    e.currentTarget.style.background = "rgba(255, 255, 255, 0.8)"; // sáng hơn khi hover
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow = "0 10px 25px -8px rgba(0, 100, 80, 0.25), 0 3px 8px rgba(0, 0, 0, 0.05), inset 0 1px 2px rgba(255,255,255,0.6)";
    e.currentTarget.style.background = "rgba(255, 255, 255, 0.7)";
  }}
>
  {/* Giờ - to vừa phải, chữ đậm */}
  <div
    style={{
      fontSize: "20px",
      fontWeight: "600",
      letterSpacing: "1.5px",
      color: "#0f3d32",
      lineHeight: 1.2,
      textShadow: "0 1px 4px rgba(0,70,60,0.1)",
    }}
  >
    {formatTime()}
  </div>

  {/* Ngày - nhỏ, nhẹ, chữ hoa */}
  <div
    style={{
      fontSize: "10px",
      marginTop: "2px",
      color: "#2a6b5a",
      fontWeight: "500",
      letterSpacing: "0.6px",
      textTransform: "uppercase",
      opacity: 0.7,
    }}
  >
    {formatDate()}
  </div>
</div>
  );
};

export default AnalogClock;