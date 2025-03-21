import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, message, Modal } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import logger from '../utils/logger'; // 引入前端日誌工具

const { Option } = Select;

const BASE_URL = 'http://localhost:5000';

const ApplyItem = () => {
    const [form] = Form.useForm();
    const [kills, setKills] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [userApplications, setUserApplications] = useState([]);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            message.error('請先登錄！');
            navigate('/login');
            return;
        }
        fetchKills();
        fetchUserApplications();
    }, [token, navigate]);

    const fetchKills = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/boss-kills`, {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched kills:', res.data);
            // 過濾只包含 status === 'pending' 的擊殺記錄
            const pendingKills = res.data.filter(kill => {
                const killStatus = kill.status ? kill.status.toLowerCase() : 'pending';
                console.log(`Kill ${kill._id} status:`, killStatus); // 調試日志
                return killStatus === 'pending';
            });
            console.log('Filtered pending kills:', pendingKills); // 調試日志
            setKills(pendingKills);
        } catch (err) {
            console.error('Fetch kills error:', err.response?.data || err.message);
            message.error('載入擊殺記錄失敗: ' + (err.response?.data?.msg || err.message));
        }
    };

    const fetchUserApplications = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/applications/user`, {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched user applications:', res.data);
            const activeApplications = res.data.filter(app => app.status === 'pending' || app.status === 'approved');
            setUserApplications(activeApplications.map(app => `${app.kill_id._id}_${app.item_id}`));
        } catch (err) {
            console.error('Fetch user applications error:', err.response?.data || err.message);
            message.warning('無法載入申請記錄，限制可能不準確');
        }
    };

    const handleKillChange = (value) => {
        const selectedKill = kills.find(kill => kill._id === value);
        if (selectedKill) {
            // 直接使用 dropped_items，因為 kills 已過濾為 status === 'pending'
            setFilteredItems(selectedKill.dropped_items || []);
        } else {
            setFilteredItems([]);
        }
        form.setFieldsValue({ item_name: undefined });
        console.log('Selected kill:', selectedKill);
        console.log('Filtered items:', selectedKill?.dropped_items || []); // 調試日志
    };

    const handleSubmit = async (values) => {
        console.log('handleSubmit triggered with values:', values);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                message.error('請先登錄！');
                navigate('/login');
                return;
            }
            const selectedKill = kills.find(kill => kill._id === values.kill_id);
            const selectedItem = filteredItems.find(item => item.name === values.item_name);
            if (!selectedKill) {
                throw new Error('選擇的擊殺記錄無效');
            }
            if (!selectedItem || !selectedItem._id) {
                console.error('Selected item does not have an item_id:', selectedItem);
                throw new Error('物品缺少唯一標識，請聯繫管理員');
            }

            const applicationKey = `${values.kill_id}_${selectedItem._id}`;
            if (userApplications.includes(applicationKey)) {
                throw new Error('您已為此物品提交申請，無法再次申請！');
            }
            console.log('Sending request with data:', {
                kill_id: values.kill_id,
                item_id: selectedItem._id,
                item_name: values.item_name,
            });
            const res = await axios.post(
                `${BASE_URL}/api/applications`,
                {
                    kill_id: values.kill_id,
                    item_id: selectedItem._id,
                    item_name: values.item_name,
                },
                { headers: { 'x-auth-token': token } }
            );
            console.log('API response:', res.data);
            message.success(res.data.msg || '申請提交成功！');
            setTimeout(() => {
                navigate('/kill-history');
            }, 1000);
            form.resetFields();
            fetchUserApplications();
        } catch (err) {
            console.error('Submit error:', err.response?.data || err);
            const errorMsg = err.response?.data?.msg || err.message || '申請失敗，請稍後再試';
            setErrorMsg(errorMsg);
            setErrorModalVisible(true);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>申請物品</h2>
            <Form form={form} name="apply-item" onFinish={handleSubmit} layout="vertical">
                <Form.Item
                    name="kill_id"
                    label="選擇擊殺記錄"
                    rules={[{ required: true, message: '請選擇擊殺記錄' }]}
                >
                    <Select placeholder="選擇擊殺記錄" onChange={handleKillChange} allowClear>
                        {kills.map(kill => (
                            <Option key={kill._id} value={kill._id}>
                                {kill.boss_name} - {moment(kill.kill_time).format('YYYY-MM-DD HH:mm')}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item
                    name="item_name"
                    label="選擇物品"
                    rules={[{ required: true, message: '請選擇物品' }]}
                >
                    <Select placeholder="選擇物品" disabled={!form.getFieldValue('kill_id')}>
                        {filteredItems.map(item => {
                            const applicationKey = `${form.getFieldValue('kill_id')}_${item._id}`;
                            const isApplied = userApplications.includes(applicationKey);
                            return (
                                <Option
                                    key={item._id}
                                    value={item.name}
                                    disabled={isApplied}
                                >
                                    {item.name} ({item.type}, 截止 {moment(item.apply_deadline).format('YYYY-MM-DD')})
                                    {isApplied && ' [已申請]'}
                                </Option>
                            );
                        })}
                    </Select>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit">
                        提交申請
                    </Button>
                </Form.Item>
            </Form>
            <Modal
                title="錯誤"
                visible={errorModalVisible}
                onOk={() => setErrorModalVisible(false)}
                onCancel={() => setErrorModalVisible(false)}
            >
                <p>{errorMsg}</p>
            </Modal>
        </div>
    );
};

export default ApplyItem;