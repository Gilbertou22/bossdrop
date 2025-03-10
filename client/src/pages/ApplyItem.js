import React, { useState, useEffect } from 'react';
import { Form, Button, Select, message, Modal } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

const ApplyItem = () => {
    const [form] = Form.useForm();
    const [kills, setKills] = useState([]);
    const [items, setItems] = useState([]);
    const [filteredKills, setFilteredKills] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [existingApplications, setExistingApplications] = useState({});
    const [currentUser, setCurrentUser] = useState(null);
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchKills();
        fetchItems();
        fetchCurrentUser();
        fetchUserApplications();
    }, []);

    const fetchKills = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/boss-kills', {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched kills:', res.data);
            setKills(res.data);
            const unassignedKills = res.data.filter(
                kill => kill.status === 'pending' && !kill.final_recipient
            );
            setFilteredKills(unassignedKills);
        } catch (err) {
            message.error('載入擊殺記錄失敗: ' + (err.message || '未知錯誤'));
            console.error('Fetch kills error:', err);
        }
    };

    const fetchItems = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/items');
            setItems(res.data);
        } catch (err) {
            message.error('載入物品失敗: ' + (err.message || '未知錯誤'));
            console.error('Fetch items error:', err);
        }
    };

    const fetchCurrentUser = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const res = await axios.get('http://localhost:5000/api/users/me', {
                    headers: { 'x-auth-token': token },
                });
                setCurrentUser(res.data.character_name);
            }
        } catch (err) {
            message.error('載入用戶信息失敗: ' + (err.message || '未知錯誤'));
            console.error('Fetch current user error:', err);
        }
    };

    const fetchUserApplications = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token && currentUser) {
                const res = await axios.get('http://localhost:5000/api/applications', {
                    headers: { 'x-auth-token': token },
                });
                const userApplications = res.data.filter(app => app.user_id.character_name === currentUser);
                const applicationMap = {};
                userApplications.forEach(app => {
                    applicationMap[`${app.kill_id}_${app.item_id}`] = true; // 使用 item_id
                });
                setExistingApplications(applicationMap);
            }
        } catch (err) {
            message.error('載入用戶申請失敗: ' + (err.message || '未知錯誤'));
            console.error('Fetch user applications error:', err);
        }
    };

    const handleKillChange = (killId) => {
        const selectedKill = kills.find(kill => kill._id === killId);
        if (selectedKill) {
            const availableItems = selectedKill.dropped_items
                .filter(item => !(selectedKill.status === 'assigned' && selectedKill.final_recipient && selectedKill.final_recipient !== ''))
                .map(item => ({
                    name: item.name,
                    type: item.type,
                    item_id: item._id,
                }));
            console.log('Available items for kill:', availableItems);
            setFilteredItems(availableItems);
            form.setFieldsValue({ item_name: undefined });
        } else {
            setFilteredItems([]);
        }
    };

    const onFinish = (values) => {
        console.log('onFinish triggered with values:', values);
        if (window.confirm(
            `確認提交以下申請？\n\n` +
            `- 擊殺記錄: ${values.kill_id}\n` +
            `- 物品名稱: ${values.item_name}`
        )) {
            handleSubmit(values);
        } else {
            console.log('Submission cancelled');
        }
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
            if (!selectedItem || !selectedItem.item_id) {
                console.error('Selected item does not have an item_id:', selectedItem);
                throw new Error('物品缺少唯一標識，請聯繫管理員');
            }
            console.log('Sending request with item_id:', selectedItem.item_id);
            const res = await axios.post(
                'http://localhost:5000/api/applications',
                {
                    kill_id: values.kill_id,
                    item_id: selectedItem.item_id,
                    item_name: values.item_name,
                },
                { headers: { 'x-auth-token': token } }
            );
            console.log('API response:', res.data);
            alert(res.data.msg || '申請提交成功，等待審核！');
            setTimeout(() => {
                navigate('/');
            }, 1000);
            form.resetFields();
            fetchUserApplications();
        } catch (err) {
            console.error('Submit error:', err);
            const errorMsg = err.response?.data?.msg || err.message || '申請失敗，請稍後重試';
            setErrorMsg(errorMsg);
            setErrorModalVisible(true);
        }
    };

    const isApplied = (killId, itemName) => {
        return currentUser && existingApplications[`${killId}_${itemName}`];
    };

    return (
        <div style={{ maxWidth: 400, margin: '50px auto' }}>
            <h2>申請掉落物品</h2>
            <Form form={form} name="apply_item" onFinish={onFinish} layout="vertical">
                <Form.Item
                    name="kill_id"
                    label="擊殺記錄"
                    rules={[{ required: true, message: '請選擇擊殺記錄！' }]}
                >
                    <Select placeholder="選擇擊殺記錄" onChange={handleKillChange} disabled={filteredKills.length === 0}>
                        {filteredKills.map(kill => (
                            <Option key={kill._id} value={kill._id}>
                                {kill.boss_name} - {moment(kill.kill_time).format('YYYY-MM-DD HH:mm')}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item
                    name="item_name"
                    label="物品名稱"
                    rules={[{ required: true, message: '請選擇物品名稱！' }]}
                >
                    <Select placeholder="選擇物品" disabled={filteredItems.length === 0}>
                        {filteredItems.map(item => (
                            <Option
                                key={item.item_id}
                                value={item.name}
                                disabled={isApplied(form.getFieldValue('kill_id'), item.name)}
                            >
                                {item.name} ({item.type})
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        disabled={filteredItems.length === 0 || isApplied(form.getFieldValue('kill_id'), form.getFieldValue('item_name'))}
                    >
                        提交申請
                    </Button>
                </Form.Item>
            </Form>

            <Modal
                title="錯誤"
                open={errorModalVisible}
                onOk={() => setErrorModalVisible(false)}
                onCancel={() => setErrorModalVisible(false)}
                footer={[
                    <Button key="ok" type="primary" onClick={() => setErrorModalVisible(false)}>
                        確認
                    </Button>,
                ]}
                style={{ top: '20%', textAlign: 'center' }}
                bodyStyle={{ padding: '20px', fontSize: '16px', color: '#333' }}
            >
                <p>{errorMsg}</p>
            </Modal>
        </div>
    );
};

export default ApplyItem;