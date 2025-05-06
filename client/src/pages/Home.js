import React, { useState, useEffect } from 'react';
import { Card, List, Avatar, Button, Space, Typography, Divider, Spin, message, Statistic, Row, Col, Select, Badge, Progress } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import moment from 'moment';
import { FileDoneOutlined, ShoppingOutlined, TeamOutlined, UserOutlined, WarningOutlined, BarChartOutlined, BellOutlined, HistoryOutlined, TrophyOutlined } from '@ant-design/icons';
import formatNumber from '../utils/formatNumber';
import statusTag from '../utils/statusTag';
import { useNotification } from '../components/NotificationContext';
import ReactECharts from 'echarts-for-react';
import logger from '../utils/logger';

const { Title, Text } = Typography;
const { Option } = Select;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const Home = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const { notifications } = useNotification();
    const [user, setUser] = useState(null);
    const [auctions, setAuctions] = useState([]);
    const [bossKills, setBossKills] = useState([]);
    const [adminStats, setAdminStats] = useState(null);
    const [userGrowth, setUserGrowth] = useState([]);
    const [auctionTrend, setAuctionTrend] = useState([]);
    const [applicationTrend, setApplicationTrend] = useState([]);
    const [userStats, setUserStats] = useState({ participationCount: 0, auctionSuccessCount: 0 });
    const [timeRange, setTimeRange] = useState(30);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        fetchData();
    }, [token, timeRange, navigate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 獲取用戶信息
            const userRes = await axios.get(`${BASE_URL}/api/users/profile`, {
                headers: { 'x-auth-token': token },
            });
            const fetchedUser = userRes.data;
            setUser(fetchedUser);

            // 獲取熱門拍賣
            const auctionsRes = await axios.get(`${BASE_URL}/api/auctions?status=active`, {
                headers: { 'x-auth-token': token },
            });
            const enrichedAuctions = await Promise.all(auctionsRes.data.slice(0, 3).map(async (auction) => {
                let imageUrl = 'wp1.jpg';
                if (auction.itemId) {
                    const itemId = typeof auction.itemId === 'object' && auction.itemId._id
                        ? auction.itemId._id
                        : auction.itemId;
                    if (typeof itemId !== 'string') {
                        logger.warn('Invalid itemId in auction', { auctionId: auction._id, itemId });
                        return { ...auction, imageUrl };
                    }
                    const bossKillRes = await axios.get(`${BASE_URL}/api/boss-kills/${itemId}`, {
                        headers: { 'x-auth-token': token },
                    });
                    const bossKill = bossKillRes.data;
                    if (bossKill && bossKill.dropped_items?.length) {
                        imageUrl = bossKill.dropped_items[0].imageUrl || 'wp1.jpg';
                    }
                }
                return { ...auction, imageUrl };
            }));
            setAuctions(enrichedAuctions);

            // 獲取最近擊殺記錄
            const bossKillsRes = await axios.get(`${BASE_URL}/api/boss-kills`, {
                headers: { 'x-auth-token': token },
            });
            // 修正：從 bossKillsRes.data.data 中提取擊殺記錄
            const killData = Array.isArray(bossKillsRes.data.data) ? bossKillsRes.data.data : [];
            const enrichedBossKills = await Promise.all(killData.slice(0, 3).map(async (kill) => {
                let imageUrl = 'wp1.jpg';
                if (kill.dropped_items?.length) {
                    imageUrl = kill.dropped_items[0].imageUrl || 'wp1.jpg';
                }
                return { ...kill, imageUrl };
            }));
            setBossKills(enrichedBossKills);

            // 獲取用戶統計數據（普通用戶）
            const userStatsRes = await axios.get(`${BASE_URL}/api/users/personal-stats`, {
                headers: { 'x-auth-token': token },
            });
            setUserStats(userStatsRes.data);

            // 管理員數據
            if (token && fetchedUser && fetchedUser.role === 'admin') {
                const requests = [
                    axios.get(`${BASE_URL}/api/users/stats`, { headers: { 'x-auth-token': token } }).catch(err => ({ error: err })),
                    axios.get(`${BASE_URL}/api/auctions/pending-count`, { headers: { 'x-auth-token': token } }).catch(err => ({ error: err })),
                    axios.get(`${BASE_URL}/api/auctions/monitor`, { headers: { 'x-auth-token': token } }).catch(err => ({ error: err })),
                    axios.get(`${BASE_URL}/api/users/growth?range=${timeRange}`, { headers: { 'x-auth-token': token } }).catch(err => ({ error: err })),
                    axios.get(`${BASE_URL}/api/auctions/trend`, { headers: { 'x-auth-token': token } }).catch(err => ({ error: err })),
                    axios.get(`${BASE_URL}/api/applications/trend?range=${timeRange}`, { headers: { 'x-auth-token': token } }).catch(err => ({ error: err })),
                ];
                const [statsRes, applicationsRes, monitorRes, userGrowthRes, auctionTrendRes, applicationTrendRes] = await Promise.all(requests);

                const adminStatsData = {};
                if (!statsRes.error) {
                    adminStatsData.totalUsers = statsRes.data.totalUsers;
                    adminStatsData.activeUsers = statsRes.data.activeUsers;
                } else {
                    logger.error('Error fetching user stats:', statsRes.error);
                }
                if (!applicationsRes.error) {
                    adminStatsData.pendingApplications = applicationsRes.data.count;
                } else {
                    logger.error('Error fetching pending applications:', applicationsRes.error);
                }
                if (!monitorRes.error) {
                    adminStatsData.soonEndingCount = monitorRes.data.soonEndingCount;
                    adminStatsData.alertAuctions = monitorRes.data.alertAuctions;
                } else {
                    logger.error('Error fetching auction monitor:', monitorRes.error);
                }

                setAdminStats(adminStatsData);
                setUserGrowth(userGrowthRes.error ? [] : userGrowthRes.data);
                setAuctionTrend(auctionTrendRes.error ? [] : auctionTrendRes.data);
                setApplicationTrend(applicationTrendRes.error ? [] : applicationTrendRes.data);
            }
        } catch (err) {
            if (err.response?.status === 401 || err.response?.status === 403) {
                message.error('請登錄以查看更多內容');
                localStorage.removeItem('token');
                navigate('/login');
            } else {
                message.error('載入數據失敗，請稍後重試');
            }
        } finally {
            setLoading(false);
        }
    };

    const userGrowthChartOption = {
        title: { text: `用戶增長趨勢（${timeRange}天）`, textStyle: { fontSize: 16 } },
        xAxis: { type: 'category', data: userGrowth.map(item => item._id) },
        yAxis: { type: 'value' },
        series: [{ data: userGrowth.map(item => item.count), type: 'line', smooth: true, color: '#1890ff' }],
        tooltip: { trigger: 'axis' },
        toolbox: { feature: { saveAsImage: {} } },
        dataZoom: [{ type: 'inside' }, { type: 'slider' }],
    };

    const auctionTrendChartOption = {
        title: { text: `拍賣成交趨勢（${timeRange}天）`, textStyle: { fontSize: 16 } },
        xAxis: { type: 'category', data: auctionTrend.map(item => item._id) },
        yAxis: [
            { type: 'value', name: '成交數量' },
            { type: 'value', name: '總額', position: 'right' },
        ],
        series: [
            { name: '成交數量', data: auctionTrend.map(item => item.count), type: 'line', smooth: true, color: '#52c41a' },
            { name: '總額', data: auctionTrend.map(item => item.totalPrice), type: 'line', yAxisIndex: 1, smooth: true, color: '#fadb14' },
        ],
        tooltip: { trigger: 'axis' },
        toolbox: { feature: { saveAsImage: {} } },
        dataZoom: [{ type: 'inside' }, { type: 'slider' }],
    };

    const applicationTrendChartOption = {
        title: { text: `物品申請趨勢（${timeRange}天）`, textStyle: { fontSize: 16 } },
        xAxis: { type: 'category', data: applicationTrend.map(item => item._id) },
        yAxis: { type: 'value' },
        series: [{ data: applicationTrend.map(item => item.count), type: 'line', smooth: true, color: '#eb2f96' }],
        tooltip: { trigger: 'axis' },
        toolbox: { feature: { saveAsImage: {} } },
        dataZoom: [{ type: 'inside' }, { type: 'slider' }],
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', paddingTop: '84px', minHeight: 'calc(100vh - 64px)', boxSizing: 'border-box' }}>
            {loading ? (
                <Spin tip="加載中..." fullscreen style={{ display: 'block', margin: '50px auto' }} />
            ) : (
                <>
                    {/* 用戶概覽模塊 */}
                    <Card style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
                        <Row gutter={[16, 16]} align="middle">
                            <Col xs={24} md={12}>
                                <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                                    歡迎{user ? `，${user.character_name}` : '使用系統'}！
                                </Title>
                                {user && (
                                    <Text style={{ fontSize: '16px', color: '#595959' }}>
                                        您的鑽石餘額：<span style={{ color: '#1890ff', fontWeight: 'bold' }}>{formatNumber(user.diamonds)} 💎</span>
                                    </Text>
                                )}
                            </Col>
                            <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                                <Space wrap>
                                    <Button
                                        type="primary"
                                        icon={<ShoppingOutlined />}
                                        onClick={() => navigate('/auction')}
                                        style={{ borderRadius: '8px', transition: 'all 0.3s' }}
                                    >
                                        參與競標
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<FileDoneOutlined />}
                                        onClick={() => navigate('/apply-item')}
                                        style={{ borderRadius: '8px', transition: 'all 0.3s' }}
                                    >
                                        申請物品
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<HistoryOutlined />}
                                        onClick={() => navigate('/kill-history')}
                                        style={{ borderRadius: '8px', transition: 'all 0.3s' }}
                                    >
                                        擊殺歷史
                                    </Button>
                                </Space>
                            </Col>
                        </Row>
                    </Card>

                    {/* 普通用戶統計數據 */}
                    <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                        <Col xs={24} sm={12} md={6}>
                            <Card
                                hoverable
                                style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}
                                onClick={() => navigate('/kill-history')}
                            >
                                <Statistic
                                    title="參與擊殺次數"
                                    value={userStats.participationCount || 0}
                                    valueStyle={{ color: '#1890ff' }}
                                    prefix={<HistoryOutlined />}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Card
                                hoverable
                                style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}
                                onClick={() => navigate('/auction')}
                            >
                                <Statistic
                                    title="拍賣成功次數"
                                    value={userStats.auctionSuccessCount || 0}
                                    valueStyle={{ color: '#52c41a' }}
                                    prefix={<TrophyOutlined />}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {/* 最近通知模塊 */}
                    <Card
                        title={
                            <Space>
                                <BellOutlined style={{ color: '#1890ff' }} />
                                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>最近通知</Title>
                            </Space>
                        }
                        style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
                    >
                        {notifications.length > 0 ? (
                            <List
                                itemLayout="horizontal"
                                dataSource={notifications.slice(0, 3)}
                                renderItem={(notification) => (
                                    <List.Item
                                        onClick={() => navigate(`/notification/${notification._id}`)}
                                        style={{ cursor: 'pointer', padding: '12px 0', transition: 'background-color 0.3s' }}
                                        className="notification-item"
                                    >
                                        <List.Item.Meta
                                            avatar={<Avatar icon={<BellOutlined />} style={{ backgroundColor: notification.read ? '#f0f0f0' : '#ff4d4f' }} />}
                                            title={
                                                <Space>
                                                    <Text>{notification.message}</Text>
                                                    {!notification.read && <Badge dot />}
                                                </Space>
                                            }
                                            description={
                                                <Text type="secondary">{moment(notification.createdAt).fromNow()}</Text>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        ) : (
                            <Text type="secondary">暫無通知</Text>
                        )}
                        <div style={{ textAlign: 'center', marginTop: '10px' }}>
                            <Button type="link" onClick={() => navigate('/notifications')}>
                                查看所有通知
                            </Button>
                        </div>
                    </Card>

                    {/* 熱門拍賣模塊 */}
                    <Card
                        title={
                            <Space>
                                <ShoppingOutlined style={{ color: '#1890ff' }} />
                                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>熱門拍賣（即將結束）</Title>
                            </Space>
                        }
                        style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
                    >
                        {auctions.length > 0 ? (
                            <List
                                itemLayout="horizontal"
                                dataSource={auctions}
                                renderItem={(auction) => {
                                    const timeLeft = moment(auction.endTime).diff(moment(), 'seconds');
                                    const progress = Math.max(0, (timeLeft / (24 * 60 * 60)) * 100); // 假設 24 小時為總時長
                                    return (
                                        <List.Item
                                            onClick={() => navigate(`/auction/${auction._id}`)}
                                            style={{ cursor: 'pointer', padding: '12px 0', transition: 'background-color 0.3s' }}
                                            className="list-item-hover"
                                        >
                                            <List.Item.Meta
                                                avatar={<Avatar src={auction.imageUrl} style={{ borderRadius: '50%' }} loading="lazy" />}
                                                title={
                                                    <Space>
                                                        <Text strong>拍賣 ID: {auction._id}</Text>
                                                        {statusTag(auction.status)}
                                                    </Space>
                                                }
                                                description={
                                                    <div>
                                                        <Text>當前價格: <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{formatNumber(auction.currentPrice)} 鑽石</span></Text><br />
                                                        <Text type="secondary">結束時間: {moment(auction.endTime).format('YYYY-MM-DD HH:mm:ss')}</Text><br />
                                                        <Progress percent={progress} size="small" showInfo={false} strokeColor={timeLeft < 3600 ? '#ff4d4f' : '#1890ff'} />
                                                    </div>
                                                }
                                            />
                                        </List.Item>
                                    );
                                }}
                            />
                        ) : (
                            <Text type="secondary">暫無正在進行的拍賣</Text>
                        )}
                        <div style={{ textAlign: 'center', marginTop: '10px' }}>
                            <Button type="link" onClick={() => navigate('/auction')}>
                                查看所有拍賣
                            </Button>
                        </div>
                    </Card>

                    {/* 最近擊殺記錄模塊 */}
                    <Card
                        title={
                            <Space>
                                <HistoryOutlined style={{ color: '#1890ff' }} />
                                <Title level={4} style={{ margin: 0, color: '#1890ff' }}>最近擊殺記錄</Title>
                            </Space>
                        }
                        style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
                    >
                        {bossKills.length > 0 ? (
                            <List
                                itemLayout="horizontal"
                                dataSource={bossKills}
                                renderItem={(kill) => (
                                    <List.Item
                                        onClick={() => navigate('/kill-history')}
                                        style={{ cursor: 'pointer', padding: '12px 0', transition: 'background-color 0.3s' }}
                                        className="list-item-hover"
                                    >
                                        <List.Item.Meta
                                            avatar={<Avatar src={kill.imageUrl} style={{ borderRadius: '50%' }} loading="lazy" />}
                                            title={
                                                <Space>
                                                    <Text strong>首領: {kill.bossId?.name || '未知首領'}</Text>
                                                    {statusTag(kill.status)}
                                                </Space>
                                            }
                                            description={
                                                <div>
                                                    <Text>擊殺時間: {moment(kill.kill_time).format('YYYY-MM-DD HH:mm:ss')}</Text><br />
                                                    <Text type="secondary">掉落物品: {kill.dropped_items?.map(item => item.name).join(', ') || '無'}</Text>
                                                </div>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        ) : (
                            <Text type="secondary">暫無擊殺記錄</Text>
                        )}
                        <div style={{ textAlign: 'center', marginTop: '10px' }}>
                            <Button type="link" onClick={() => navigate('/kill-history')}>
                                查看所有擊殺記錄
                            </Button>
                        </div>
                    </Card>

                    {/* 管理員 Dashboard 模塊 */}
                    {user && user.role === 'admin' && adminStats && (
                        <>
                            <Divider style={{ margin: '24px 0' }}>
                                <Title level={4} style={{ color: '#1890ff' }}>管理員控制台</Title>
                            </Divider>

                            <Space style={{ marginBottom: '24px' }}>
                                <Text>時間範圍：</Text>
                                <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
                                    <Option value={7}>7 天</Option>
                                    <Option value={30}>30 天</Option>
                                    <Option value={90}>90 天</Option>
                                </Select>
                            </Space>

                            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                <Col xs={24} sm={12} md={6}>
                                    <Card
                                        hoverable
                                        style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}
                                        onClick={() => navigate('/manage-users')}
                                    >
                                        <Statistic
                                            title="總用戶數"
                                            value={adminStats.totalUsers || 0}
                                            valueStyle={{ color: '#3f8600' }}
                                            prefix={<UserOutlined />}
                                        />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} md={6}>
                                    <Card
                                        hoverable
                                        style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}
                                        onClick={() => navigate('/manage-users')}
                                    >
                                        <Statistic
                                            title="活躍用戶數"
                                            value={adminStats.activeUsers || 0}
                                            valueStyle={{ color: '#3f8600' }}
                                            prefix={<UserOutlined />}
                                        />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} md={6}>
                                    <Card
                                        hoverable
                                        style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}
                                        onClick={() => navigate('/approve-applications')}
                                    >
                                        <Statistic
                                            title="待審核申請"
                                            value={adminStats.pendingApplications || 0}
                                            valueStyle={{ color: '#cf1322' }}
                                            prefix={<FileDoneOutlined />}
                                        />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} md={6}>
                                    <Card
                                        hoverable
                                        style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}
                                        onClick={() => navigate('/auction')}
                                    >
                                        <Statistic
                                            title="即將結束拍賣"
                                            value={adminStats.soonEndingCount || 0}
                                            valueStyle={{ color: '#cf1322' }}
                                            prefix={<ShoppingOutlined />}
                                        />
                                    </Card>
                                </Col>
                            </Row>

                            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                                <Col xs={24} md={8}>
                                    <Card title="用戶增長趨勢" style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
                                        <ReactECharts option={userGrowthChartOption} style={{ height: '300px' }} />
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card title="拍賣成交趨勢" style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
                                        <ReactECharts option={auctionTrendChartOption} style={{ height: '300px' }} />
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card title="物品申請趨勢" style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
                                        <ReactECharts option={applicationTrendChartOption} style={{ height: '300px' }} />
                                    </Card>
                                </Col>
                            </Row>

                            <Card
                                title={
                                    <Space>
                                        <WarningOutlined style={{ color: '#ff4d4f' }} />
                                        <Title level={4} style={{ margin: 0, color: '#ff4d4f' }}>系統警報</Title>
                                    </Space>
                                }
                                style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
                            >
                                {adminStats.alertAuctions && adminStats.alertAuctions.length > 0 ? (
                                    <List
                                        itemLayout="horizontal"
                                        dataSource={adminStats.alertAuctions}
                                        renderItem={(alert) => (
                                            <List.Item
                                                onClick={() => navigate(`/auction/${alert._id}`)}
                                                style={{ cursor: 'pointer', padding: '12px 0', transition: 'background-color 0.3s' }}
                                                className="list-item-hover"
                                            >
                                                <List.Item.Meta
                                                    avatar={<Avatar icon={<WarningOutlined />} style={{ backgroundColor: '#ff4d4f' }} />}
                                                    title={<Text strong>拍賣 ID: {alert._id}</Text>}
                                                    description={
                                                        <div>
                                                            <Text type="danger">
                                                                {alert.endTime < new Date() ? '已超期' : '無有效出價'}
                                                            </Text>
                                                        </div>
                                                    }
                                                />
                                            </List.Item>
                                        )}
                                    />
                                ) : (
                                    <Text type="secondary">無當前警報</Text>
                                )}
                                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                    <Button type="link" onClick={() => navigate('/auction')}>
                                        查看所有拍賣
                                    </Button>
                                </div>
                            </Card>
                        </>
                    )}
                </>
            )}
            <style jsx global>{`
                body {
                    margin: 0;
                }
                .list-item-hover:hover {
                    background-color: #f0f4f8;
                }
                .notification-item:hover {
                    background-color: #f0f4f8;
                }
                .ant-card {
                    transition: transform 0.3s ease;
                }
                .ant-card:hover {
                    transform: translateY(-4px);
                }
                .ant-btn-primary {
                    transition: all 0.3s ease;
                }
                .ant-btn-primary:hover {
                    transform: scale(1.05);
                }
            `}</style>
        </div>
    );
};

export default Home;