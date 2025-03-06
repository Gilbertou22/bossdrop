import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSpring, animated } from 'react-spring';

// 假設圖片放在 public/images/ 目錄下，使用占位符鏈接
const bossKillImage = '/images/boss-kill.jpg'; // 替換為實際路徑或保持占位符
const auctionImage = '/images/auction.jpg';    // 替換為實際路徑或保持占位符
const statsImage = '/images/stats.jpg';        // 替換為實際路徑或保持占位符
const placeholderImage = 'https://via.placeholder.com/300x150?text='; // 通用占位符

const { Title, Paragraph } = Typography;

const Home = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    // 添加狀態用於調試刷新次數
    const [renderCount, setRenderCount] = useState(0);

    useEffect(() => {
        console.log('Home component rendered, count:', renderCount); // 調試渲染次數
        setRenderCount(prev => prev + 1);
        // 清理函數，防止記憶體洩漏
        return () => console.log('Home component unmounted');
    }, []);

    const fadeIn = useSpring({
        from: { opacity: 0, transform: 'translateY(20px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
        config: { duration: 500 },
        reset: false, // 防止重複動畫觸發刷新
    });

    // 處理圖片錯誤並調試
    const handleImageError = (e, text) => {
        console.log(`Image load failed for ${text}, using placeholder:`, e);
        e.target.src = `${placeholderImage}${encodeURIComponent(text)}`;
    };

    return (
        <div style={{ maxWidth: 1000, margin: '50px auto' }}>
            
            {!token && (
                <Row justify="center" style={{ marginTop: 20 }}>
                    <Button
                        type="primary"
                        size="large"
                        onClick={() => navigate('/login')}
                        style={{ padding: '0 30px' }}
                    >
                        立即登錄
                    </Button>
                </Row>
            )}
        </div>
    );
};

export default Home;