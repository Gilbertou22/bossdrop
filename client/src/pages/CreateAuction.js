import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Card, message, Spin, Row, Col, AutoComplete, DatePicker, Select } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import ErrorBoundary from '../components/ErrorBoundary'; // 根據文件結構調整路徑

const CreateAuction = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [itemOptions, setItemOptions] = useState([]);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    const fetchAuctionableItems = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/items/auctionable', {
                headers: { 'x-auth-token': token },
            });
            const options = res.data.map(item => ({
                value: item._id,
                label: `${item.name || '無名稱'}`,
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
            setItemOptions([]); // 設置空選項
        }
    }, [token]);

    useEffect(() => {
        fetchAuctionableItems();
    }, [fetchAuctionableItems]);


    const onFinish = async (values) => {
        setLoading(true);
        try {
            const startingPrice = parseInt(values.startingPrice);
            if (isNaN(startingPrice) || startingPrice < 100 || startingPrice > 9999) {
                throw new Error('起標價格必須在 100-9999 之間！');
            }
            console.log('Submitting auction form:', values);
            let endTime = values.endTime;
            if (endTime && moment(endTime).isValid()) {
                endTime = moment.utc(endTime).set({ hour: 23, minute: 59, second: 59 }).toISOString();
            } else {
                throw new Error('請選擇截止時間！');
            }
            const now = moment.utc();
            if (moment.utc(endTime).isBefore(now)) {
                throw new Error('截止時間必須晚於現在！');
            }
            // 提取 bossKillId 作為 itemId
            const itemId = values.itemId.split('_')[0];
            await axios.post('http://localhost:5000/api/auctions', {
                itemId,
                startingPrice,
                endTime,
            }, {
                headers: { 'x-auth-token': token },
            });
            message.success('競標創建成功！');
            form.resetFields();
            setDate(null); // 重置 date 狀態
            navigate('/auction');
        } catch (err) {
            console.error('Create auction error:', err);
            message.error(`創建失敗: ${err.message || err.response?.data?.msg}`);
        } finally {
            setLoading(false);
        }
    };

    const [date, setDate] = useState(new Date());

    return (
        <ErrorBoundary>
            <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                <Card title="發起新競標" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
                    <Spin spinning={loading}>
                        <Form
                            form={form}
                            name="createAuction"
                            onFinish={onFinish}
                            layout="vertical"
                            initialValues={{ startingPrice: 100 }} // 無預設 endTime
                            requiredMark={true}
                        >
                            <Row gutter={16}>
                                <Col xs={24} sm={24} md={24}>
                                    <Form.Item
                                        name="itemId"
                                        label="物品ID"
                                        rules={[{ required: true, message: '請選擇或輸入物品ID！' }]}
                                        hasFeedback
                                    >
                                        <Select
                                            placeholder="請選擇物品ID"
                                            options={itemOptions}
                                            onChange={(value) => form.setFieldsValue({ itemId: value })}
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
                                <Col xs={24} sm={24} md={24}>
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
                                                if (charCode < 48 || charCode > 57) e.preventDefault(); // 僅允許數字
                                            }}
                                            min={100}
                                            max={9999}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={24} md={24}>
                                    <Form.Item
                                        name="endTime"
                                        label="截止時間"
                                        rules={[
                                            { required: true, message: '請選擇截止時間！' },
                                            {
                                                validator: (_, value) => {

                                                    if (!value) return Promise.reject(new Error('請選擇截止時間！'));

                                                    if (!value.isValid()) return Promise.reject(new Error('無效的日期格式！'));
                                                    const now = moment();

                                                    if (value.isBefore(now)) return Promise.reject(new Error('截止時間必須晚於現在！'));
                                                    return Promise.resolve();
                                                },
                                            },
                                        ]}
                                        hasFeedback
                                        getValueFromEvent={(date, dateString) => (date ? date : null)} // 傳遞 moment 對象
                                    >
                                        <DatePicker
                                            format="YYYY-MM-DD"
                                            placeholder="請選擇截止日期（時間將設為23:59:59）"
                                            selected={date}
                                            onChange={(date) => setDate(date)}
                                            style={{ width: '100%' }}
                                            getPopupContainer={trigger => trigger.parentElement} // 確保彈出層正確顯示
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    disabled={loading}
                                    style={{ width: '100%' }}
                                >
                                    {loading ? '創建中...' : '創建競標'}
                                </Button>
                            </Form.Item>
                        </Form>
                    </Spin>
                </Card>
            </div>
        </ErrorBoundary>
    );
};

export default CreateAuction;