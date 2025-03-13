import React, { useState, useEffect } from 'react';
import { Form, Button, Upload, AutoComplete, Select, message, DatePicker, Input, Row, Col, Alert, Spin, Card } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import imageCompression from 'browser-image-compression';

const { Option } = Select;
const { TextArea } = Input;

const BASE_URL = 'http://localhost:5000';

const BossKillForm = () => {
    const [fileList, setFileList] = useState([]);
    const [form] = Form.useForm();
    const [bosses, setBosses] = useState([]);
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [bossOptions, setBossOptions] = useState([]);
    const [itemOptions, setItemOptions] = useState([]);
    const [userOptions, setUserOptions] = useState([]);
    const [date, setDate] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchBosses();
        fetchItems();
        fetchUsers();
        form.setFieldsValue({ kill_time: null });

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

    const fetchBosses = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/bosses`);
            setBosses(res.data);
            setBossOptions(res.data.map(boss => ({ value: boss.name })));
        } catch (err) {
            message.error('載入首領失敗');
        }
    };

    const fetchItems = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/items`);
            setItems(res.data);
            setItemOptions(res.data.map(item => ({ value: item.name, type: item.type })));
        } catch (err) {
            message.error('載入物品失敗');
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users`, {
                headers: { 'x-auth-token': token },
            });
            console.log('Fetched users:', res.data);
            const validUsers = Array.isArray(res.data) ? res.data.map(user => user.character_name) : [];
            setUsers(validUsers);
            setUserOptions(validUsers.map(name => ({ value: name, label: name })));
        } catch (err) {
            message.error('載入用戶失敗: ' + err.message);
        }
    };

    // 圖片壓縮選項
    const compressionOptions = {
        maxSizeMB: 0.6, // 最大 600KB
        maxWidthOrHeight: 1024, // 最大寬高
        useWebWorker: true,
    };

    const handleBeforeUpload = async (file) => {
        setUploading(true);
        try {
            const isImage = file.type === 'image/jpeg' || file.type === 'image/png';
            if (!isImage) {
                message.error('僅支援 JPEG/PNG 圖片！');
                setUploading(false);
                return Upload.LIST_IGNORE;
            }

            const isLt600KB = file.size / 1024 <= 600;
            if (isLt600KB) {
                setFileList([...fileList, file]);
                setUploading(false);
                return false;
            }

            message.info('圖片過大，正在壓縮...');
            const compressedFile = await imageCompression(file, compressionOptions);
            console.log('Compressed file size:', compressedFile.size / 1024, 'KB');

            if (compressedFile.size / 1024 > 600) {
                message.error('圖片壓縮後仍超過 600KB，請選擇更小的圖片！');
                setUploading(false);
                return Upload.LIST_IGNORE;
            }

            setFileList([...fileList, { ...compressedFile, uid: file.uid, name: file.name, originFileObj: compressedFile }]);
            setUploading(false);
            return false;
        } catch (err) {
            console.error('Image compression error:', err);
            message.error('圖片壓縮失敗，請重試！');
            setUploading(false);
            return Upload.LIST_IGNORE;
        }
    };

    const handleRemove = (file) => {
        setFileList(fileList.filter(item => item.uid !== file.uid));
    };

    const onFinish = (values) => {
        console.log('onFinish triggered with values:', values);
        if (fileList.length === 0) {
            message.error('請至少上傳一張圖片！');
            return;
        }

        if (values.item_names && values.item_names.length > 0) {
            const itemsText = values.item_names.join(', ');
            if (window.confirm(
                `確認提交以下信息？\n\n` +
                `- 首領名稱: ${values.boss_name}\n` +
                `- 擊殺時間: ${values.kill_time ? values.kill_time.format('YYYY-MM-DD HH:mm') : ''}\n` +
                `- 掉落物品: ${itemsText}\n` +
                `- 出席成員: ${Array.isArray(values.attendees) ? values.attendees.join(', ') : ''}\n` +
                `- 補充圖片數量: ${fileList.length} 張`
            )) {
                handleSubmit(values);
            } else {
                console.log('Submission cancelled');
            }
        } else {
            message.error('請至少選擇一個掉落物品！');
        }
    };

    const handleSubmit = async (values) => {
        setLoading(true);
        const itemNames = values.item_names || [];
        const results = [];

        for (const itemName of itemNames) {
            const formData = new FormData();
            formData.append('boss_name', values.boss_name);
            formData.append('kill_time', values.kill_time.toISOString());
            const droppedItem = {
                name: itemName,
                type: items.find(i => i.name === itemName)?.type || 'equipment',
            };
            formData.append('dropped_items', JSON.stringify([droppedItem]));
            const attendeesArray = Array.isArray(values.attendees) ? values.attendees : [];
            formData.append('attendees', JSON.stringify(attendeesArray));
            fileList.forEach(file => formData.append('screenshots', file.originFileObj));

            try {
                if (!token) {
                    message.error('請先登錄！');
                    window.location.href = '/login';
                    return;
                }
                console.log(`Sending request for item: ${itemName}`);
                const res = await axios.post(`${BASE_URL}/api/boss-kills`, formData, {
                    headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
                });
                results.push(res.data);
                console.log(`API response for ${itemName}:`, res.data);
            } catch (err) {
                console.error(`Submit error for ${itemName}:`, err);
                message.error(`提交失敗 (${itemName}): ${err.response?.data?.msg || err.message}`);
                if (err.response?.status === 401 || err.response?.status === 403) {
                    window.location.href = '/login';
                }
            }
        }

        if (results.length > 0) {
            const successIds = results.map(r => r.kill_id).join(', ');
            alert(`擊殺記錄成功！ID: ${successIds}`);
            form.resetFields();
            setFileList([]);
            form.setFieldsValue({ kill_time: null });
        }
        setLoading(false);
    };

    const uploadProps = {
        onChange: ({ fileList: newFileList }) => {
            setFileList(newFileList.slice(-5));
        },
        beforeUpload: handleBeforeUpload,
        onRemove: handleRemove,
        fileList,
        listType: 'picture-card',
        showUploadList: {
            showPreviewIcon: true,
            showRemoveIcon: true,
            showDownloadIcon: false,
        },
        previewFile: file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file.originFileObj || file);
            });
        },
        maxCount: 5,
        accept: 'image/jpeg,image/png',
    };

    const handleBossSearch = (value) => {
        const filteredOptions = bosses
            .filter(boss => boss.name.toLowerCase().includes(value.toLowerCase()))
            .map(boss => ({ value: boss.name }));
        setBossOptions(filteredOptions);
    };

    const handleItemSearch = (value) => {
        const filteredOptions = items
            .filter(item => item.name.toLowerCase().includes(value.toLowerCase()))
            .map(item => ({ value: item.name, type: item.type }));
        setItemOptions(filteredOptions);
    };

    const handleAttendeesChange = (value) => {
        if (value.includes('all')) {
            const allAttendees = userOptions.map(option => option.value);
            form.setFieldsValue({ attendees: allAttendees });
        } else {
            form.setFieldsValue({ attendees: value.filter(val => val !== 'all') });
        }
        console.log('Selected attendees:', value);
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={
                    <Row justify="space-between" align="middle">
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>記錄擊殺</h2>
                        {deferredPrompt && (
                            <Button type="link" onClick={handleInstallPWA}>
                                安裝應用
                            </Button>
                        )}
                    </Row>
                }
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px', maxWidth: 1000, margin: '0 auto' }}
            >
                <Spin spinning={loading} size="large">
                    <Form
                        form={form}
                        name="boss_kill"
                        onFinish={onFinish}
                        layout="vertical"
                        style={{ maxWidth: '100%' }}
                        initialValues={{ kill_time: null }}
                        requiredMark={true}
                    >
                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="boss_name"
                                    label="首領名稱"
                                    rules={[{ required: true, message: '請輸入或選擇首領名稱！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <AutoComplete
                                        options={bossOptions}
                                        onSearch={handleBossSearch}
                                        placeholder="輸入或選擇首領名稱"
                                        autoComplete="off"
                                        hasFeedback
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="kill_time"
                                    label="擊殺時間"
                                    rules={[{ required: true, message: '請選擇擊殺時間！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <DatePicker
                                        format="YYYY-MM-DD HH:mm"
                                        showTime={{ format: 'HH:mm' }}
                                        value={date}
                                        onChange={(date) => setDate(date)}
                                        style={{ width: '100%' }}
                                        getPopupContainer={trigger => trigger.parentElement}
                                        disabledDate={(current) => current && current > moment().endOf('day')}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="item_names"
                                    label="掉落物品（多選）"
                                    rules={[{ required: true, message: '請選擇至少一個掉落物品！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        placeholder="請選擇掉落物品（可多選）"
                                        onSearch={handleItemSearch}
                                        onChange={(values) => {
                                            values.forEach(value => {
                                                const item = items.find(i => i.name === value);
                                                if (!item) console.warn(`Item not found for value: ${value}`);
                                            });
                                        }}
                                        options={itemOptions}
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="attendees"
                                    label="出席成員"
                                    rules={[{ required: true, message: '請至少選擇一名出席成員！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        style={{ width: '100%' }}
                                        placeholder="請選擇出席成員（可多選）"
                                        onChange={handleAttendeesChange}
                                        value={form.getFieldValue('attendees')}
                                    >
                                        <Option key="all" value="all">
                                            選擇全部
                                        </Option>
                                        {userOptions.map(option => (
                                            <Option key={option.value} value={option.value}>
                                                {option.label}
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item
                            name="screenshots"
                            label="補充圖片（至少1張，最多5張）"
                            rules={[{ required: true, message: '請至少上傳一張補充圖片！' }]}
                            style={{ marginBottom: 16, marginTop: 16 }}
                        >
                            <Upload {...uploadProps}>
                                <Button icon={<UploadOutlined />} loading={uploading}>
                                    上傳圖片
                                </Button>
                            </Upload>
                        </Form.Item>
                        <Form.Item style={{ marginBottom: 0 }}>
                            <Button type="primary" htmlType="submit" block disabled={uploading || !online}>
                                提交
                            </Button>
                        </Form.Item>
                    </Form>
                    {!online && (
                        <Alert
                            message="離線模式"
                            description="目前處於離線模式，無法上傳圖片或記錄擊殺。"
                            type="warning"
                            showIcon
                            style={{ marginTop: '16px' }}
                        />
                    )}
                </Spin>
            </Card>
            <style jsx>{`
                .ant-upload-list-picture-card .ant-upload-list-item {
                    margin: 12px;
                    border: 1px solid #d9d9d9;
                    border-radius: 4px;
                }
                .ant-upload-list-picture-card .ant-upload-list-item-thumbnail img {
                    object-fit: contain;
                    width: 100%;
                    height: 100%;
                    border-radius: 4px;
                }
                .ant-upload-list-picture-card .ant-upload-list-item-name {
                    display: none;
                }
                .ant-upload-list-picture-card .ant-upload-list-item-card-actions {
                    background: rgba(0, 0, 0, 0.5);
                }
                .ant-upload-list-picture-card .ant-upload-list-item-card-actions-btn {
                    opacity: 0.8;
                }
            `}</style>
        </div>
    );
};

export default BossKillForm;