import React, { useState, useEffect } from 'react';
import { Table, Tag, Card, message, Select, DatePicker, Button, Space } from 'antd';
import axios from 'axios';
import moment from 'moment';
import logger from '../utils/logger';
import formatNumber from '../utils/formatNumber';
import { DownloadOutlined } from '@ant-design/icons';
import Papa from 'papaparse'; // 用於導出 CSV

const { Option } = Select;
const { RangePicker } = DatePicker;

const BASE_URL = 'http://localhost:5000';

const Wallet = () => {
    const [transactions, setTransactions] = useState([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [loading, setLoading] = useState(false);
    const [diamonds, setDiamonds] = useState(0);
    const [filters, setFilters] = useState({
        type: null,
        dateRange: null,
    });

    useEffect(() => {
        fetchUserInfo();
        fetchTransactions();
    }, []);

    const fetchUserInfo = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            setDiamonds(res.data.diamonds || 0);
        } catch (err) {
            logger.error('Fetch user info error in Wallet', { error: err.message, stack: err.stack });
            message.error('無法獲取用戶信息');
        }
    };

    const fetchTransactions = async (page = 1, pageSize = 10) => {
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
    };

    const handleTableChange = (pagination) => {
        fetchTransactions(pagination.current, pagination.pageSize);
    };

    const handleFilterChange = () => {
        fetchTransactions(1, pagination.pageSize); // 重置到第一頁
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
                金額: `${transaction.amount > 0 ? '+' : ''}${formatNumber(transaction.amount)} 💎`,
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

    const columns = [
        {
            title: '時間',
            dataIndex: 'timestamp',
            key: 'timestamp',
            sorter: (a, b) => moment(a.timestamp).unix() - moment(b.timestamp).unix(),
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: '類型',
            dataIndex: 'type',
            key: 'type',
            render: (type) => (
                <Tag color={type === 'income' ? 'green' : 'red'}>
                    {type === 'income' ? '收入' : '支出'}
                </Tag>
            ),
        },
        {
            title: '金額',
            dataIndex: 'amount',
            key: 'amount',
            sorter: (a, b) => a.amount - b.amount,
            render: (amount) => (
                <span style={{ color: amount > 0 ? '#52c41a' : '#ff4d4f' }}>
                    {amount > 0 ? '+' : ''}{formatNumber(amount)} 💎
                </span>
            ),
        },
        {
            title: '來源',
            dataIndex: 'source',
            key: 'source',
            render: (source) => {
                switch (source) {
                    case 'auction':
                        return '拍賣';
                    case 'recharge':
                        return '充值';
                    case 'system':
                        return '系統';
                    default:
                        return source;
                }
            },
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
        },
    ];

    return (
        <div className="wallet-container">
            <Card title="個人錢包" className="wallet-balance-card">
                <h3>當前餘額：{formatNumber(diamonds)} 💎</h3>
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
            `}</style>
        </div>
    );
};

export default Wallet;