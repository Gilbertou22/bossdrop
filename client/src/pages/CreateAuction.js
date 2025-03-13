import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Card, Spin, Row, Col, AutoComplete, DatePicker, Select, message, Image, Descriptions, Space, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import axios from 'axios';
import ErrorBoundary from '../components/ErrorBoundary';

const { Option } = Select;

const BASE_URL = 'http://localhost:5000';

const CreateAuction = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [itemOptions, setItemOptions] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [online, setOnline] = useState(navigator.onLine); // 檢查網絡狀態
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    // PWA 安裝提示
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));
    }, []);

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    const fetchAuctionableItems = useCallback(async () => {
        if (!online) {
            message.warning('目前處於離線模式，無法獲取物品列表');
            setItemOptions([]);
            return;
        }
        try {
            const res = await axios.get(`${BASE_URL}/api/items/auctionable`, {
                headers: { 'x-auth-token': token },
            });
            const options = res.data.map(item => ({
                value: item._id,
                label: `${item.bossKillId} - ${item.name || '無名稱'}`,
                bossKillId: item.bossKillId,
                name: item.name,
                imageUrl: item.imageUrl,
                description: item.description,
            }));
            setItemOptions(options);
            console.log('Fetched auctionable items:', options);
        } catch (err) {
            console.error('Fetch auctionable items error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
            });
            message.error(`獲取可競標物品失敗: ${err.response?.data?.msg || '服務器錯誤，請稍後重試'}`);
            setItemOptions([]);
        }
    }, [token, online]);

    useEffect(() => {
        fetchAuctionableItems();
    }, [fetchAuctionableItems]);

    const onFinish = async (values) => {
        if (!online) {
            message.error('目前處於離線模式，無法創建競標');
            return;
        }
        setLoading(true);
        try {
            const startingPrice = parseInt(values.startingPrice);
            if (isNaN(startingPrice) || startingPrice < 100 || startingPrice > 9999) {
                throw new Error('起標價格必須在 100-9999 之間！');
            }

            const buyoutPrice = values.buyoutPrice ? parseInt(values.buyoutPrice) : null;
            if (buyoutPrice && (isNaN(buyoutPrice) || buyoutPrice <= startingPrice)) {
                throw new Error('直接得標價必須大於起標價格！');
            }

            let endTime = values.endTime;
            if (endTime && moment(endTime).isValid()) {
                endTime = moment(endTime).utc().endOf('day').toISOString();
            } else {
                throw new Error('請選擇截止時間！');
            }

            const now = moment.utc();
            console.log('EndTime submitted:', endTime, 'Now (UTC):', now.format());
            if (moment.utc(endTime).isBefore(now)) {
                throw new Error('截止時間必須晚於現在！');
            }

            const selectedItem = itemOptions.find(option => option.value === values.itemId);
            if (!selectedItem) {
                throw new Error('無效的物品選擇！');
            }
            const itemId = selectedItem.bossKillId;

            console.log('Submitting auction form:', { itemId, startingPrice, buyoutPrice, endTime });
            const res = await axios.post(`${BASE_URL}/api/auctions`, {
                itemId,
                startingPrice,
                buyoutPrice,
                endTime,
                status: 'active',
            }, {
                headers: { 'x-auth-token': token },
            });
            console.log('Auction creation response:', res.data);
            message.success('競標創建成功！');
            form.resetFields();
            setDate(null);
            setSelectedItem(null);
            navigate('/auction');
        } catch (err) {
            console.error('Create auction error:', err.response?.data || err);
            message.error(`創建失敗: ${err.message || err.response?.data?.msg}`);
        } finally {
            setLoading(false);
        }
    };

    const [date, setDate] = useState(null);

    return (
        <ErrorBoundary>
            <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                <Card
                    title="發起新競標"
                    bordered={false}
                    style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}
                    extra={
                        deferredPrompt && (
                            <Button type="link" onClick={handleInstallPWA}>
                                安裝應用
                            </Button>
                        )
                    }
                >
                    <Spin spinning={loading}>
                        <Form
                            form={form}
                            name="createAuction"
                            onFinish={onFinish}
                            layout="vertical"
                            initialValues={{ startingPrice: 100 }}
                            requiredMark={true}
                        >
                            <Row gutter={[16, 16]}>
                                <Col xs={24}>
                                    <Form.Item
                                        name="itemId"
                                        label="物品ID"
                                        rules={[{ required: true, message: '請選擇或輸入物品ID！' }]}
                                        hasFeedback
                                    >
                                        <Select
                                            placeholder="請選擇物品ID"
                                            options={itemOptions}
                                            onChange={(value) => {
                                                const item = itemOptions.find(option => option.value === value);
                                                setSelectedItem(item);
                                                form.setFieldsValue({ itemId: value });
                                            }}
                                            onSearch={async (value) => {
                                                if (value.length > 2) await fetchAuctionableItems();
                                            }}
                                            showSearch
                                            filterOption={(input, option) =>
                                                option.label.toLowerCase().indexOf(input.toLowerCase()) !== -1
                                            }
                                            style={{ width: '100%' }}
                                        />
                                    </Form.Item>
                                </Col>
                                {selectedItem && (
                                    <Col xs={24}>
                                        <Descriptions bordered size="small" column={1}>
                                            <Descriptions.Item label="物品名稱">{selectedItem.name}</Descriptions.Item>
                                            <Descriptions.Item label="描述">{selectedItem.description}</Descriptions.Item>
                                            <Descriptions.Item label="圖片">
                                                <Image
                                                    src={selectedItem.imageUrl}
                                                    alt={selectedItem.name}
                                                    width={50}
                                                    height={50}
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            </Descriptions.Item>
                                        </Descriptions>
                                    </Col>
                                )}
                                <Col xs={24}>
                                    <Form.Item
                                        name="startingPrice"
                                        label="起標價格 (鑽石)"
                                        rules={[
                                            { required: true, message: '請輸入起標價格！' },
                                            {
                                                validator: (_, value) => {
                                                    const numValue = parseInt(value);
                                                    if (isNaN(numValue)) return Promise.reject(new Error('請輸入有效的數字！'));
                                                    if (numValue < 100) return Promise.reject(new Error('起標價格最低為 100 鑽石！'));
                                                    if (numValue > 9999) return Promise.reject(new Error('起標價格最高為 9999 鑽石！'));
                                                    return Promise.resolve();
                                                },
                                            },
                                        ]}
                                        hasFeedback
                                    >
                                        <Input
                                            type="number"
                                            placeholder="輸入 100-9999 鑽石"
                                            onKeyPress={(e) => {
                                                const charCode = e.which ? e.which : e.keyCode;
                                                if (charCode < 48 || charCode > 57) e.preventDefault();
                                            }}
                                            min={100}
                                            max={9999}
                                            style={{ width: '100%' }}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24}>
                                    <Form.Item
                                        name="buyoutPrice"
                                        label="直接得標價 (鑽石，可選)"
                                        rules={[
                                            {
                                                validator: (_, value) => {
                                                    if (!value) return Promise.resolve();
                                                    const numValue = parseInt(value);
                                                    const startingPrice = parseInt(form.getFieldValue('startingPrice'));
                                                    if (isNaN(numValue)) return Promise.reject(new Error('請輸入有效的數字！'));
                                                    if (numValue <= startingPrice) return Promise.reject(new Error('直接得標價必須大於起標價格！'));
                                                    return Promise.resolve();
                                                },
                                            },
                                        ]}
                                        hasFeedback
                                    >
                                        <Input
                                            type="number"
                                            placeholder="輸入直接得標價（大於起標價格）"
                                            onKeyPress={(e) => {
                                                const charCode = e.which ? e.which : e.keyCode;
                                                if (charCode < 48 || charCode > 57) e.preventDefault();
                                            }}
                                            min={100}
                                            style={{ width: '100%' }}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24}>
                                    <Form.Item
                                        name="endTime"
                                        label="截止時間"
                                        rules={[
                                            { required: true, message: '請選擇截止時間！' },
                                            {
                                                validator: (_, value) => {
                                                    if (!value || !moment(value).isValid()) {
                                                        return Promise.reject(new Error('請選擇有效的截止時間！'));
                                                    }
                                                    const now = moment.utc();
                                                    const selectedTime = moment.utc(value);
                                                    if (selectedTime.isBefore(now.add(1, 'hour'))) {
                                                        return Promise.reject(new Error('截止時間必須至少在 1 小時後！'));
                                                    }
                                                    return Promise.resolve();
                                                },
                                            },
                                        ]}
                                        hasFeedback
                                    >
                                        <DatePicker
                                            showTime
                                            format="YYYY-MM-DD HH:mm:ss"
                                            placeholder="選擇截止時間（至少 1 小時後）"
                                            value={date}
                                            onChange={(date) => {
                                                console.log('DatePicker changed:', date);
                                                setDate(date);
                                                form.setFieldsValue({ endTime: date });
                                            }}
                                            disabledDate={(current) => current && current < moment().startOf('day')}
                                            disabledTime={(current) => {
                                                if (current && current.isSame(moment(), 'day')) {
                                                    return {
                                                        disabledHours: () => [...Array(moment().hour() + 1).keys()],
                                                        disabledMinutes: () => [],
                                                        disabledSeconds: () => [],
                                                    };
                                                }
                                                return {};
                                            }}
                                            style={{ width: '100%' }}
                                            getPopupContainer={trigger => trigger.parentElement}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        disabled={loading || !online}
                                        style={{ width: '100%' }}
                                    >
                                        {loading ? '創建中...' : '創建競標'}
                                    </Button>
                                    {!online && (
                                        <Alert
                                            message="離線模式"
                                            description="目前處於離線模式，無法創建競標，請檢查網絡後重試。"
                                            type="warning"
                                            showIcon
                                        />
                                    )}
                                </Space>
                            </Form.Item>
                        </Form>
                    </Spin>
                </Card>
            </div>
        </ErrorBoundary>
    );
};

export default CreateAuction;