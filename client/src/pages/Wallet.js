import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Card, message, Select, DatePicker, Button, Space, Modal, Descriptions, Image } from 'antd';
import axios from 'axios';
import moment from 'moment';
import logger from '../utils/logger';
import formatNumber from '../utils/formatNumber';
import { DownloadOutlined, EyeOutlined, ClockCircleOutlined, SwapOutlined, DollarOutlined, AppstoreOutlined, UserOutlined, CalendarOutlined, GiftOutlined, TagOutlined } from '@ant-design/icons';
import Papa from 'papaparse';

const { Option } = Select;
const { RangePicker } = DatePicker;

const BASE_URL = 'http://localhost:5000';

// 簡單的正則表達式，用於驗證 MongoDB ObjectId（24 位十六進制字符串）
const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

// 定義 colorMapping，與 KillDetailModal.js 保持一致
const colorMapping = {
    '白色': '#f0f0f0',
    '綠色': '#00cc00',
    '藍色': '#1e90ff',
    '紅色': '#EC3636',
    '紫色': '#B931F3',
    '金色': '#ffd700',
};

const Wallet = () => {
    const [transactions, setTransactions] = useState([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [loading, setLoading] = useState(false);
    const [diamonds, setDiamonds] = useState(0);
    const [dkpPoints, setDkpPoints] = useState(0); // 新增 DKP 總點數
    const [filters, setFilters] = useState({
        type: null,
        dateRange: null,
    });
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [auctionDetails, setAuctionDetails] = useState(null);

    const fetchUserInfo = useCallback(async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            setDiamonds(res.data.diamonds || 0);

            // 獲取 DKP 總點數
            const dkpRes = await axios.get(`${BASE_URL}/api/dkp/stats`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            setDkpPoints(dkpRes.data.dkpPoints || 0);
        } catch (err) {
            logger.error('Fetch user info error in Wallet', { error: err.message, stack: err.stack });
            message.error('無法獲取用戶信息');
        }
    }, []);

    const fetchTransactions = useCallback(async (page = 1, pageSize = 10) => {
        setLoading(true);
        try {
            const params = {
                page,
                pageSize,
                type: filters.type,
                startDate: filters.dateRange ? filters.dateRange[0].toISOString() : null,
                endDate: filters.dateRange ? filters.dateRange[1].toISOString() : null,
                sortBy: 'timestamp',
                sortOrder: 'desc',
            };
            const res = await axios.get(`${BASE_URL}/api/wallet/transactions`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
                params,
            });
            setTransactions(res.data.transactions);
            setPagination(res.data.pagination);
        } catch (err) {
            logger.error('Fetch wallet transactions error', { error: err.message, stack: err.stack });
            message.error('無法獲取錢包記錄');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchUserInfo();
        fetchTransactions();
    }, [fetchUserInfo, fetchTransactions]);

    const handleTableChange = (pagination) => {
        fetchTransactions(pagination.current, pagination.pageSize);
    };

    const handleFilterChange = () => {
        fetchTransactions(1, pagination.pageSize);
    };

    const handleExportCSV = async () => {
        try {
            const params = {
                type: filters.type,
                startDate: filters.dateRange ? filters.dateRange[0].toISOString() : null,
                endDate: filters.dateRange ? filters.dateRange[1].toISOString() : null,
            };
            const res = await axios.get(`${BASE_URL}/api/wallet/transactions/export`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
                params,
            });

            const data = res.data.transactions.map((transaction) => ({
                時間: moment(transaction.timestamp).format('YYYY-MM-DD HH:mm:ss'),
                類型: transaction.type === 'income' ? '收入' : '支出',
                異動: `${transaction.amount > 0 ? '▲' : '▼'}${formatNumber(Math.abs(transaction.amount))} 💎`,
                來源: transaction.source === 'auction' ? '拍賣' : transaction.source === 'recharge' ? '充值' : '系統',
                描述: transaction.description,
            }));

            const csv = Papa.unparse(data, {
                header: true,
                delimiter: ',',
            });

            const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `wallet_transactions_${moment().format('YYYYMMDD_HHmmss')}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);

            message.success('錢包記錄已導出為 CSV');
        } catch (err) {
            logger.error('Export wallet transactions error', { error: err.message, stack: err.stack });
            message.error('導出錢包記錄失敗');
        }
    };

    const handleViewDetails = async (transaction) => {
        setSelectedTransaction(transaction);
        setAuctionDetails(null);

        if (transaction.source === 'auction' && transaction.auctionId) {
            try {
                const auctionId = typeof transaction.auctionId === 'object' && transaction.auctionId._id
                    ? transaction.auctionId._id
                    : transaction.auctionId.toString();
                if (!isValidObjectId(auctionId)) {
                    logger.warn('Invalid auctionId in transaction', { transactionId: transaction._id, auctionId });
                    message.error('無效的拍賣 ID');
                    return;
                }
                const res = await axios.get(`${BASE_URL}/api/auctions/${auctionId}`, {
                    headers: { 'x-auth-token': localStorage.getItem('token') },
                });
                setAuctionDetails(res.data);
            } catch (err) {
                logger.error('Fetch auction details error', { auctionId: transaction.auctionId, error: err.message, stack: err.stack });
                message.error('無法獲取拍賣詳情');
            }
        }

        setModalVisible(true);
    };

    const columns = [
        {
            title: '時間',
            dataIndex: 'timestamp',
            key: 'timestamp',
            sorter: (a, b) => moment(a.timestamp).unix() - moment(b.timestamp).unix(),
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: '異動',
            dataIndex: 'amount',
            key: 'amount',
            sorter: (a, b) => a.amount - b.amount,
            render: (amount) => (
                <span style={{ color: amount > 0 ? '#52c41a' : '#ff4d4f' }}>
                    {amount > 0 ? '▲' : '▼'} {formatNumber(Math.abs(amount))}
                </span>
            ),
        },
        {
            title: '備註',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: '詳細',
            key: 'details',
            render: (_, record) => (
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewDetails(record)}
                >
                    查看
                </Button>
            ),
        },
    ];

    return (
        <div className="wallet-container">
            <Card title="個人錢包" className="wallet-balance-card">
                <h3>當前餘額：{formatNumber(diamonds)} 💎</h3>
                <h3>DKP 總點數：{dkpPoints}</h3> {/* 顯示 DKP 總點數 */}
            </Card>
            <Card className="wallet-filter-card">
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Space wrap>
                        <Select
                            placeholder="篩選類型"
                            style={{ width: 120 }}
                            allowClear
                            onChange={(value) => setFilters({ ...filters, type: value })}
                        >
                            <Option value="income">收入</Option>
                            <Option value="expense">支出</Option>
                        </Select>
                        <RangePicker
                            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
                            style={{ width: 240 }}
                        />
                        <Button type="primary" onClick={handleFilterChange}>
                            篩選
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
                            導出 CSV
                        </Button>
                    </Space>
                </Space>
            </Card>
            <Table
                columns={columns}
                dataSource={transactions}
                rowKey="_id"
                pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50'],
                    showTotal: (total) => `共 ${total} 條記錄`,
                }}
                loading={loading}
                onChange={handleTableChange}
                className="wallet-table"
            />

            <Modal
                title={<span style={{ fontSize: '18px', fontWeight: 'bold' }}>交易詳細</span>}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setModalVisible(false)}>
                        關閉
                    </Button>,
                ]}
                width={600}
            >
                {selectedTransaction && (
                    <div>
                        <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#1890ff' }}>交易信息</h3>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label={<span><ClockCircleOutlined style={{ marginRight: 8 }} />時間</span>}>
                                {moment(selectedTransaction.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                            </Descriptions.Item>
                            <Descriptions.Item label={<span><SwapOutlined style={{ marginRight: 8 }} />類型</span>}>
                                <Tag color={selectedTransaction.type === 'income' ? 'green' : 'red'}>
                                    {selectedTransaction.type === 'income' ? '收入' : '支出'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label={<span><DollarOutlined style={{ marginRight: 8 }} />異動</span>}>
                                <span style={{ color: selectedTransaction.amount > 0 ? '#52c41a' : '#ff4d4f' }}>
                                    {selectedTransaction.amount > 0 ? '▲' : '▼'} {formatNumber(Math.abs(selectedTransaction.amount))} 💎
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label={<span><AppstoreOutlined style={{ marginRight: 8 }} />來源</span>}>
                                {selectedTransaction.source === 'auction' ? '拍賣' : selectedTransaction.source === 'recharge' ? '充值' : '系統'}
                            </Descriptions.Item>
                            <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 8 }} />描述</span>}>
                                {selectedTransaction.description}
                            </Descriptions.Item>
                        </Descriptions>

                        {selectedTransaction.source === 'auction' && auctionDetails && (
                            <>
                                <h3 style={{ fontSize: '16px', margin: '24px 0 16px', color: '#1890ff' }}>拍賣詳情</h3>
                                <div style={{ border: '1px solid #e8e8e8', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                                    {auctionDetails.imageUrl && (
                                        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                                            <Image
                                                src={auctionDetails.imageUrl}
                                                alt={auctionDetails.itemName}
                                                style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                                            />
                                        </div>
                                    )}
                                    <Descriptions column={1} bordered size="small">
                                        <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 8 }} />拍賣 ID</span>}>
                                            {auctionDetails._id}
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><GiftOutlined style={{ marginRight: 8 }} />物品名稱</span>}>
                                            <span style={{ color: colorMapping[auctionDetails.level?.color] || colorMapping['白色'] }}>
                                                {auctionDetails.itemName || '未知物品'}
                                            </span>
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><UserOutlined style={{ marginRight: 8 }} />得標者</span>}>
                                            {auctionDetails.highestBidder?.character_name || '無'}
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><DollarOutlined style={{ marginRight: 8 }} />最終價格</span>}>
                                            {formatNumber(auctionDetails.currentPrice)} 💎
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><DollarOutlined style={{ marginRight: 8 }} />起標價格</span>}>
                                            {formatNumber(auctionDetails.startingPrice)} 💎
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><DollarOutlined style={{ marginRight: 8 }} />直接得標價</span>}>
                                            {auctionDetails.buyoutPrice ? formatNumber(auctionDetails.buyoutPrice) : '無'} 💎
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><CalendarOutlined style={{ marginRight: 8 }} />創建時間</span>}>
                                            {moment(auctionDetails.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><CalendarOutlined style={{ marginRight: 8 }} />結束時間</span>}>
                                            {moment(auctionDetails.endTime).format('YYYY-MM-DD HH:mm:ss')}
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 8 }} />狀態</span>}>
                                            <Tag
                                                color={
                                                    auctionDetails.status === 'active' ? 'green' :
                                                        auctionDetails.status === 'pending' ? 'orange' :
                                                            auctionDetails.status === 'completed' ? 'blue' :
                                                                auctionDetails.status === 'settled' ? 'purple' :
                                                                    auctionDetails.status === 'cancelled' ? 'red' : 'default'
                                                }
                                            >
                                                {auctionDetails.status === 'active' ? '活躍' :
                                                    auctionDetails.status === 'pending' ? '待處理' :
                                                        auctionDetails.status === 'completed' ? '已完成' :
                                                            auctionDetails.status === 'settled' ? '已結算' :
                                                                auctionDetails.status === 'cancelled' ? '已取消' : '未知'}
                                            </Tag>
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><UserOutlined style={{ marginRight: 8 }} />物品持有人</span>}>
                                            {auctionDetails.itemHolder || '無'}
                                        </Descriptions.Item>
                                    </Descriptions>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Modal>

            <style jsx global>{`
                .wallet-container {
                    padding: 20px;
                    background: #f5f5f5;
                    min-height: 100vh;
                }
                .wallet-balance-card {
                    margin-bottom: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    background: #fff;
                }
                .wallet-balance-card h3 {
                    font-size: 24px;
                    color: #1890ff;
                    margin: 0;
                }
                .wallet-filter-card {
                    margin-bottom: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    background: #fff;
                }
                .wallet-table {
                    background: #fff;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                .wallet-table .ant-table-tbody > tr > td {
                    padding: 8px !important;
                    line-height: 1.2 !important;
                }
                .wallet-table .ant-table-thead > tr > th {
                    padding: 8px !important;
                    background: #e8e8e8 !important;
                    font-weight: bold;
                }
                .wallet-table .ant-table-row {
                    height: 40px !important;
                }
                .ant-modal-body {
                    padding: 24px;
                }
                .ant-descriptions-item-label {
                    width: 120px;
                    background: #f5f5f5;
                    font-weight: 500;
                }
                .ant-descriptions-item-content {
                    background: #fff;
                }
            `}</style>
        </div>
    );
};

export default Wallet;