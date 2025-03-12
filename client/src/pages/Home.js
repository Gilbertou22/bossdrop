import React, { useState, useEffect } from 'react';
import { Card, List, Avatar, Button, Space, Typography, Divider, Spin, message, Statistic, Row, Col, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import moment from 'moment';
import { FileDoneOutlined, ShoppingOutlined, TeamOutlined, UserOutlined, WarningOutlined, BarChartOutlined } from '@ant-design/icons';
import formatNumber from '../utils/formatNumber';
import { useNotification } from '../components/NotificationContext';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;
const { Option } = Select;

const BASE_URL = 'http://localhost:5000';

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
    const [timeRange, setTimeRange] = useState(30);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) {
            console.log('No token found, redirecting to login');
            navigate('/login');
            return;
        }
        fetchData();
    }, [token, timeRange, navigate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            console.log('Fetching user profile with token:', token.substring(0, 20) + '...');
            const userRes = await axios.get(`${BASE_URL}/api/users/profile`, {
                headers: { 'x-auth-token': token },
            });
            const fetchedUser = userRes.data;
            setUser(fetchedUser);
            console.log('User profile fetched:', fetchedUser);

            const auctionsRes = await axios.get(`${BASE_URL}/api/auctions?status=active`, {
                headers: { 'x-auth-token': token },
            });
            const enrichedAuctions = await Promise.all(auctionsRes.data.slice(0, 3).map(async (auction) => {
                let imageUrl = 'https://via.placeholder.com/50';
                if (auction.itemId) {
                    const bossKillRes = await axios.get(`${BASE_URL}/api/boss-kills/${auction.itemId}`, {
                        headers: { 'x-auth-token': token },
                    });
                    const bossKill = bossKillRes.data;
                    if (bossKill && bossKill.dropped_items?.length) {
                        imageUrl = bossKill.dropped_items[0].imageUrl || 'https://via.placeholder.com/50';
                    }
                }
                return { ...auction, imageUrl };
            }));
            setAuctions(enrichedAuctions);

            const bossKillsRes = await axios.get(`${BASE_URL}/api/boss-kills`, {
                headers: { 'x-auth-token': token },
            });
            const enrichedBossKills = await Promise.all(bossKillsRes.data.slice(0, 3).map(async (kill) => {
                let imageUrl = 'https://via.placeholder.com/50';
                if (kill.dropped_items?.length) {
                    imageUrl = kill.dropped_items[0].imageUrl || 'https://via.placeholder.com/50';
                }
                return { ...kill, imageUrl };
            }));
            setBossKills(enrichedBossKills);

            if (token && fetchedUser && fetchedUser.role === 'admin') {
                console.log('Fetching admin data for user:', fetchedUser.character_name);
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
                    console.error('Failed to fetch stats:', statsRes.error.response?.data || statsRes.error.message);
                }
                if (!applicationsRes.error) {
                    adminStatsData.pendingApplications = applicationsRes.data.count;
                } else {
                    console.error('Failed to fetch pending applications:', applicationsRes.error.response?.data || applicationsRes.error.message);
                }
                if (!monitorRes.error) {
                    adminStatsData.soonEndingCount = monitorRes.data.soonEndingCount;
                    adminStatsData.alertAuctions = monitorRes.data.alertAuctions;
                } else {
                    console.error('Failed to fetch auction monitor:', monitorRes.error.response?.data || monitorRes.error.message);
                }

                setAdminStats(adminStatsData);
                setUserGrowth(userGrowthRes.error ? [] : userGrowthRes.data);
                setAuctionTrend(auctionTrendRes.error ? [] : auctionTrendRes.data);
                setApplicationTrend(applicationTrendRes.error ? [] : applicationTrendRes.data);
                console.log('Admin stats set:', adminStatsData);
            } else {
                console.log('User is not admin or user not fetched:', fetchedUser);
            }
        } catch (err) {
            console.error('Fetch data error:', err.response?.data || err.message);
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
        title: { text: `用戶增長趨勢（${timeRange}天）` },
        xAxis: { type: 'category', data: userGrowth.map(item => item._id) },
        yAxis: { type: 'value' },
        series: [{ data: userGrowth.map(item => item.count), type: 'line', smooth: true }],
        tooltip: { trigger: 'axis' },
    };

    const auctionTrendChartOption = {
        title: { text: `拍賣成交趨勢（${timeRange}天）` },
        xAxis: { type: 'category', data: auctionTrend.map(item => item._id) },
        yAxis: [
            { type: 'value', name: '成交數量' },
            { type: 'value', name: '總額' },
        ],
        series: [
            { name: '成交數量', data: auctionTrend.map(item => item.count), type: 'line', smooth: true },
            { name: '總額', data: auctionTrend.map(item => item.totalPrice), type: 'line', yAxisIndex: 1, smooth: true },
        ],
        tooltip: { trigger: 'axis' },
    };

    const applicationTrendChartOption = {
        title: { text: `物品申請趨勢（${timeRange}天）` },
        xAxis: { type: 'category', data: applicationTrend.map(item => item._id) },
        yAxis: { type: 'value' },
        series: [{ data: applicationTrend.map(item => item.count), type: 'line', smooth: true }],
        tooltip: { trigger: 'axis' },
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {loading ? (
                <Spin tip="加載中..." fullscreen style={{ display: 'block', margin: '50px auto' }} />
            ) : (
                <>
                    <Card style={{ marginBottom: '20px' }}>
                        <Title level={2}>
                            歡迎{user ? `，${user.character_name}` : '使用系統'}！
                        </Title>
                        {user && (
                            <Text>
                                您的鑽石餘額：{formatNumber(user.diamonds)} 💎
                            </Text>
                        )}
                        <Divider />
                        <Space>
                            <Button
                                type="primary"
                                icon={<FileDoneOutlined />}
                                onClick={() => navigate('/apply-item')}
                            >
                                申請物品
                            </Button>
                            <Button
                                type="primary"
                                icon={<ShoppingOutlined />}
                                onClick={() => navigate('/auction')}
                            >
                                參與競標
                            </Button>
                            <Button
                                type="primary"
                                icon={<TeamOutlined />}
                                onClick={() => navigate('/kill-history')}
                            >
                                查看擊殺歷史
                            </Button>
                        </Space>
                    </Card>

                    <Card title="未讀通知" style={{ marginBottom: '20px' }}>
                        {notifications.length > 0 ? (
                            <List
                                itemLayout="horizontal"
                                dataSource={notifications.slice(0, 3)}
                                renderItem={(notification) => (
                                    <List.Item
                                        onClick={() => {
                                            if (notification.auctionId) navigate(`/auction/${notification.auctionId}`);
                                        }}
                                        style={{ cursor: notification.auctionId ? 'pointer' : 'default' }}
                                    >
                                        <List.Item.Meta
                                            avatar={<Avatar src={notification.imageUrl} />}
                                            title={<Text>{notification.message}</Text>}
                                            description={<Text type="secondary">{moment(notification.createdAt).fromNow()}</Text>}
                                        />
                                    </List.Item>
                                )}
                            />
                        ) : (
                            <Text type="secondary">暫無未讀通知</Text>
                        )}
                        <div style={{ textAlign: 'center', marginTop: '10px' }}>
                            <Button type="link" onClick={() => navigate('/notifications')}>
                                查看所有通知
                            </Button>
                        </div>
                    </Card>

                    <Card title="熱門拍賣（即將結束）" style={{ marginBottom: '20px' }}>
                        {auctions.length > 0 ? (
                            <List
                                itemLayout="horizontal"
                                dataSource={auctions}
                                renderItem={(auction) => (
                                    <List.Item
                                        onClick={() => navigate(`/auction/${auction._id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <List.Item.Meta
                                            avatar={<Avatar src={auction.imageUrl} />}
                                            title={<Text>拍賣 ID: {auction._id}</Text>}
                                            description={
                                                <div>
                                                    <Text>當前價格: {formatNumber(auction.currentPrice)} 鑽石</Text><br />
                                                    <Text type="secondary">結束時間: {moment(auction.endTime).format('YYYY-MM-DD HH:mm:ss')}</Text>
                                                </div>
                                            }
                                        />
                                    </List.Item>
                                )}
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

                    <Card title="最近擊殺記錄">
                        {bossKills.length > 0 ? (
                            <List
                                itemLayout="horizontal"
                                dataSource={bossKills}
                                renderItem={(kill) => (
                                    <List.Item
                                        onClick={() => navigate('/kill-history')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <List.Item.Meta
                                            avatar={<Avatar src={kill.imageUrl} />}
                                            title={<Text>首領: {kill.boss_name}</Text>}
                                            description={
                                                <div>
                                                    <Text>擊殺時間: {moment(kill.kill_date).format('YYYY-MM-DD HH:mm:ss')}</Text><br />
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

                    {user && user.role === 'admin' && adminStats && (
                        <>
                            <Divider>管理員 Dashboard</Divider>

                            <Space style={{ marginBottom: '20px' }}>
                                <Text>時間範圍：</Text>
                                <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
                                    <Option value={7}>7 天</Option>
                                    <Option value={30}>30 天</Option>
                                    <Option value={90}>90 天</Option>
                                </Select>
                            </Space>

                            <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
                                <Col xs={24} sm={12} md={6}>
                                    <Card>
                                        <Statistic
                                            title="總用戶數"
                                            value={adminStats.totalUsers || 0}
                                            valueStyle={{ color: '#3f8600' }}
                                            onClick={() => navigate('/manage-users')}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} md={6}>
                                    <Card>
                                        <Statistic
                                            title="活躍用戶數"
                                            value={adminStats.activeUsers || 0}
                                            valueStyle={{ color: '#3f8600' }}
                                            onClick={() => navigate('/manage-users')}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} md={6}>
                                    <Card>
                                        <Statistic
                                            title="待審核申請"
                                            value={adminStats.pendingApplications || 0}
                                            valueStyle={{ color: '#cf1322' }}
                                            onClick={() => navigate('/approve-applications')}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </Card>
                                </Col>
                                <Col xs={24} sm={12} md={6}>
                                    <Card>
                                        <Statistic
                                            title="即將結束拍賣"
                                            value={adminStats.soonEndingCount || 0}
                                            valueStyle={{ color: '#cf1322' }}
                                            onClick={() => navigate('/auction')}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </Card>
                                </Col>
                            </Row>

                            <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
                                <Col xs={24} md={8}>
                                    <Card title="用戶增長趨勢">
                                        <ReactECharts option={userGrowthChartOption} style={{ height: '300px' }} />
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card title="拍賣成交趨勢">
                                        <ReactECharts option={auctionTrendChartOption} style={{ height: '300px' }} />
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card title="物品申請趨勢">
                                        <ReactECharts option={applicationTrendChartOption} style={{ height: '300px' }} />
                                    </Card>
                                </Col>
                            </Row>

                            <Card title="系統警報" style={{ marginBottom: '20px' }}>
                                {adminStats.alertAuctions && adminStats.alertAuctions.length > 0 ? (
                                    <List
                                        itemLayout="horizontal"
                                        dataSource={adminStats.alertAuctions}
                                        renderItem={(alert) => (
                                            <List.Item
                                                onClick={() => navigate(`/auction/${alert._id}`)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <List.Item.Meta
                                                    avatar={<Avatar icon={<WarningOutlined />} />}
                                                    title={<Text>拍賣 ID: {alert._id}</Text>}
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

                            <Card title="快速操作">
                                <Space wrap>
                                    <Button
                                        type="primary"
                                        icon={<FileDoneOutlined />}
                                        onClick={() => navigate('/approve-applications')}
                                    >
                                        審核申請
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<ShoppingOutlined />}
                                        onClick={() => navigate('/create-auction')}
                                    >
                                        創建拍賣
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<UserOutlined />}
                                        onClick={() => navigate('/manage-users')}
                                    >
                                        管理用戶
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<BarChartOutlined />}
                                        onClick={() => navigate('/stats')}
                                    >
                                        查看統計報表
                                    </Button>
                                </Space>
                            </Card>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default Home;