import React, { useState, useEffect } from 'react';
import { Form, Button, Upload, Select, message, DatePicker, Input, Row, Col, Alert, Spin, Card, Space, Typography, Modal, Tag } from 'antd';
import { UploadOutlined, UserOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import imageCompression from 'browser-image-compression';
import logger from '../utils/logger';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const colorMapping = {
    '白色': '#f0f0f0',
    '綠色': '#00cc00',
    '藍色': '#1e90ff',
    '紅色': '#EC3636',
    '紫色': '#B931F3',
    '金色': '#ffd700',
};

const BossKillForm = () => {
    const [fileList, setFileList] = useState([]);
    const [form] = Form.useForm();
    const [bosses, setBosses] = useState([]);
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [userOptions, setUserOptions] = useState({
        attendees: [],
        itemHolder: [],
        guildCaptain: null,
    });
    const [date, setDate] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [online, setOnline] = useState(navigator.onLine);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [logText, setLogText] = useState('');
    const [userRoles, setUserRoles] = useState([]);
    const [addItemModalVisible, setAddItemModalVisible] = useState(false); // 新增物品模態框
    const [itemForm] = Form.useForm(); // 新增物品表單
    const [itemLevels, setItemLevels] = useState([]); // 物品等級選項
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            message.error('請先登入！');
            window.location.href = '/login';
            return;
        }

        fetchUserRoles();
        fetchBosses();
        fetchItems();
        fetchUsers();
        fetchItemLevels(); // 獲取物品等級
        form.setFieldsValue({ kill_time: null });

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));
    }, []);

    const fetchUserRoles = async () => {
        try {
            setRolesLoading(true);
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setUserRoles(res.data.roles || []);
            console.log('Fetched user roles:', res.data.roles);
        } catch (err) {
            message.error('無法載入用戶信息，請重新登入');
            window.location.href = '/login';
        } finally {
            setRolesLoading(false);
        }
    };

    const fetchItemLevels = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/items/item-levels`, {
                headers: { 'x-auth-token': token },
            });
            setItemLevels(res.data);
        } catch (err) {
            message.error('載入物品等級失敗');
        }
    };

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    logger.info('User accepted the install prompt');
                } else {
                    logger.info('User dismissed the install prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    const fetchBosses = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/bosses`, {
                headers: { 'x-auth-token': token },
            });
            setBosses(res.data);
        } catch (err) {
            message.error('載入首領失敗');
        }
    };

    const fetchItems = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/items`, {
                headers: { 'x-auth-token': token },
            });
            setItems(res.data);
        } catch (err) {
            message.error('載入物品失敗');
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users`, {
                headers: { 'x-auth-token': token },
            });

            if (!Array.isArray(res.data)) {
                throw new Error('後端返回的用戶數據格式不正確');
            }

            const filteredAttendees = res.data
                .filter(user => !user.roles.includes('guild') && !user.roles.includes('admin'))
                .map(user => user.character_name);

            const filteredItemHolders = res.data
                .filter(user => !user.roles.includes('guild'))
                .map(user => user.character_name);

            const guildCaptain = res.data.find(user => user.roles.includes('admin'))?.character_name;

            setUsers(res.data.map(user => user.character_name));
            setUserOptions({
                attendees: [
                    { value: 'all', label: '選擇全部' },
                    ...filteredAttendees.map(name => ({ value: name, label: name }))
                ],
                itemHolder: filteredItemHolders.map(name => ({ value: name, label: name })),
                guildCaptain,
            });
        } catch (err) {
            message.error('載入用戶失敗: ' + err.message);
            logger.error('Fetch users failed', { error: err.message, stack: err.stack });
        }
    };

    const compressionOptions = {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 1024,
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

            if (compressedFile.size / 1024 > 600) {
                message.error('圖片壓縮後仍超過 600KB，請選擇更小的圖片！');
                setUploading(false);
                return Upload.LIST_IGNORE;
            }

            setFileList([...fileList, { ...compressedFile, uid: file.uid, name: file.name, originFileObj: compressedFile }]);
            setUploading(false);
            return false;
        } catch (err) {
            message.error('圖片壓縮失敗，請重試！');
            setUploading(false);
            return Upload.LIST_IGNORE;
        }
    };

    const handleRemove = (file) => {
        setFileList(fileList.filter(item => item.uid !== file.uid));
    };

    const getDefaultImage = async () => {
        try {
            const response = await fetch('/wp.jpg');
            if (!response.ok) {
                throw new Error('無法載入預設圖片');
            }
            const blob = await response.blob();
            return new File([blob], 'wp.jpg', { type: 'image/jpeg' });
        } catch (err) {
            message.error('載入預設圖片失敗，請手動上傳圖片');
            logger.error('Failed to load default image', { error: err.message });
            return null;
        }
    };

    const parseLogAndFillForm = () => {
        try {
            const lines = logText.split('\n').map(line => line.trim()).filter(line => line);

            const headerLine = lines[0];
            const contentLine = lines[1];

            const headers = headerLine.split(/\t| {4}/).map(h => h.trim());
            const contents = contentLine.split(/\t| {4}/).map(c => c.trim());

            if (headers.length !== contents.length) {
                message.error(`日誌格式錯誤：表頭字段數 (${headers.length}) 與內容字段數 (${contents.length}) 不一致`);
                return;
            }

            const logData = {};
            headers.forEach((header, index) => {
                logData[header] = contents[index];
            });

            const timeStr = logData['消滅時間'];
            let killTime = null;
            if (timeStr) {
                const timeRegex = /(\d{4}\.\d{2}\.\d{2})[- ](\d{2}\.\d{2}\.\d{2}|\d{2}:\d{2}:\d{2})/;
                const match = timeStr.match(timeRegex);
                if (match) {
                    const datePart = match[1];
                    let timePart = match[2];
                    timePart = timePart.replace(/\./g, ':');
                    const formattedTime = `${datePart.replace(/\./g, '-')} ${timePart}`;
                    killTime = moment(formattedTime, 'YYYY-MM-DD HH:mm:ss');
                    if (!killTime.isValid()) {
                        message.warning('消滅時間格式無效，請手動選擇');
                    } else {
                        form.setFieldsValue({ kill_time: killTime });
                        setDate(killTime);
                    }
                } else {
                    message.warning('未找到有效的消滅時間格式，請手動選擇');
                }
            } else {
                message.warning('未找到消滅時間，請手動選擇');
            }

            const bossName = logData['首領'];
            if (bossName) {
                const boss = bosses.find(b => b.name === bossName);
                if (boss) {
                    form.setFieldsValue({ bossId: boss._id });
                } else {
                    message.warning(`未找到首領 ${bossName}，請手動選擇`);
                }
            }

            const distribution = logData['分配方式'];
            const guildCaptainName = logData['旅團部隊長'];
            if (distribution) {
                if (distribution.includes('旅團部隊長獲得')) {
                    if (guildCaptainName && users.includes(guildCaptainName)) {
                        form.setFieldsValue({ itemHolder: guildCaptainName });
                        message.success(`已自動選擇旅團部隊長 ${guildCaptainName} 作為戰利品持有人`);
                    } else {
                        message.warning('未找到旅團部隊長或旅團部隊長不在用戶列表中，請手動選擇物品持有人');
                    }
                } else {
                    const holderMatch = distribution.match(/物品持有人,\s*([^ ]+)/);
                    if (holderMatch) {
                        const itemHolder = holderMatch[1];
                        if (users.includes(itemHolder)) {
                            form.setFieldsValue({ itemHolder });
                        } else {
                            message.warning(`未找到用戶 ${itemHolder}，請手動選擇物品持有人`);
                        }
                    } else {
                        message.warning('未找到物品持有人，請手動選擇');
                    }
                }
            } else {
                message.warning('未找到分配方式，請手動選擇物品持有人');
            }

            const attendeesStartIndex = lines.findIndex(line => line.startsWith('戰鬥參與者'));
            const attendeesEndIndex = lines.findIndex(line => line.startsWith('旅團部隊成員'));
            if (attendeesStartIndex !== -1 && attendeesEndIndex !== -1) {
                const attendeesLines = lines.slice(attendeesStartIndex + 1, attendeesEndIndex);
                const attendees = attendeesLines
                    .map(line => line.trim())
                    .filter(line => line);
                const validAttendees = attendees.filter(attendee => users.includes(attendee));
                if (validAttendees.length > 0) {
                    form.setFieldsValue({ attendees: validAttendees });
                } else {
                    message.warning('未找到有效的戰鬥參與者，請手動選擇');
                }
            }

            const itemsStartIndex = lines.findIndex(line => line.startsWith('戰利品'));
            if (itemsStartIndex !== -1) {
                const itemsLines = lines.slice(itemsStartIndex + 1);
                const droppedItems = itemsLines
                    .map(line => {
                        const parts = line.split(/\t| {4}/).map(part => part.trim());
                        if (parts.length >= 2) {
                            const itemName = parts[0];
                            return itemName;
                        }
                        return null;
                    })
                    .filter(item => item);
                const validItems = droppedItems
                    .map(itemName => items.find(item => item.name === itemName))
                    .filter(item => item)
                    .map(item => ({ name: item.name }));
                if (validItems.length > 0) {
                    form.setFieldsValue({ item_names: validItems });
                } else {
                    message.warning('未找到有效的戰利品，請手動選擇');
                }
            }

            message.success('已自動填寫表單，請檢查並提交');
        } catch (err) {
            message.error('解析旅團日誌失敗，請檢查格式並重試');
        }
    };

    const onFinish = (values) => {
        if (values.item_names && values.item_names.length > 0) {
            const itemsText = values.item_names.map(item => item.name).join(', ');
            if (window.confirm(
                `確認提交以下信息？\n\n` +
                `- 首領名稱: ${bosses.find(b => b._id === values.bossId)?.name || '未知'}\n` +
                `- 擊殺時間: ${values.kill_time ? values.kill_time.format('YYYY-MM-DD HH:mm') : ''}\n` +
                `- 掉落物品: ${itemsText}\n` +
                `- 出席成員: ${Array.isArray(values.attendees) ? values.attendees.join(', ') : ''}\n` +
                `- 物品持有人: ${values.itemHolder || '未分配'}\n` +
                `- 補充圖片數量: ${fileList.length > 0 ? fileList.length : '使用預設圖片 (wp.jpg)'}`
            )) {
                handleSubmit(values);
            }
        } else {
            message.error('請至少選擇一個掉落物品！');
        }
    };

    const handleSubmit = async (values) => {
        setLoading(true);
        const itemNames = values.item_names || [];
        const results = [];

        for (const item of itemNames) {
            const selectedItem = items.find(i => i.name === item.name);
            if (!selectedItem) {
                message.error(`未找到物品 ${item.name} 的等級信息`);
                setLoading(false);
                return;
            }

            const formData = new FormData();
            formData.append('bossId', values.bossId);
            formData.append('kill_time', values.kill_time.toISOString());
            const droppedItem = {
                name: item.name,
                type: selectedItem.type || 'equipment',
                level: selectedItem.level,
            };
            formData.append('dropped_items', JSON.stringify([droppedItem]));
            const attendeesArray = Array.isArray(values.attendees) ? values.attendees : [];
            formData.append('attendees', JSON.stringify(attendeesArray));
            formData.append('itemHolder', values.itemHolder || '');

            if (fileList.length === 0) {
                /*
                const defaultImage = await getDefaultImage();
                if (defaultImage) {
                    formData.append('screenshots', defaultImage);
                } else {
                    setLoading(false);
                    return;
                }
                */
            } else {
                fileList.forEach(file => formData.append('screenshots', file.originFileObj));
            }

            try {
                if (!token) {
                    message.error('請先登錄！');
                    window.location.href = '/login';
                    return;
                }

                const res = await axios.post(`${BASE_URL}/api/boss-kills`, formData, {
                    headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
                });
                results.push(res.data);

                const killId = res.data.results[0]?.kill_id;
                if (killId) {
                    await axios.post(`${BASE_URL}/api/dkp/distribute/${killId}`, {}, {
                        headers: { 'x-auth-token': token },
                    });
                    logger.info('DKP distributed for kill', { killId });
                }

                logger.info('Boss kill recorded', { killId });
            } catch (err) {
                message.error(`提交失敗 (${item.name}): ${err.response?.data?.msg || err.message}`);
                if (err.response?.status === 401 || err.response?.status === 403) {
                    window.location.href = '/login';
                }
            }
        }

        if (results.length > 0) {
            const successIds = results.map(r => r.results[0]?.kill_id).join(', ');
            alert(`擊殺記錄成功！ID: ${successIds}`);
            form.resetFields();
            setFileList([]);
            setLogText('');
            form.setFieldsValue({ kill_time: null });
        }
        setLoading(false);
    };

    const handleAddItem = async (values) => {
        try {
            setLoading(true);
            const newItem = {
                name: values.name,
                type: values.type,
                level: values.level,
                description: values.description || '',
                imageUrl: values.imageUrl || '',
            };
            const res = await axios.post(`${BASE_URL}/api/items`, newItem, {
                headers: { 'x-auth-token': token },
            });
            const addedItem = res.data;
            setItems([...items, addedItem]); // 更新本地 items 狀態
            message.success('新物品添加成功！');

            // 自動將新物品添加到表單
            const currentItems = form.getFieldValue('item_names') || [];
            form.setFieldsValue({
                item_names: [...currentItems, { name: addedItem.name }],
            });

            setAddItemModalVisible(false);
            itemForm.resetFields();
        } catch (err) {
            message.error(`添加新物品失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
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

    const handleAttendeesChange = (value) => {
        const filteredValue = value.filter(val => val !== 'all');
        const allAttendees = userOptions.attendees
            .filter(option => option.value !== 'all')
            .map(option => option.value);

        if (value.includes('all')) {
            const isAllSelected = filteredValue.length === allAttendees.length;
            if (isAllSelected) {
                form.setFieldsValue({ attendees: [] });
            } else {
                form.setFieldsValue({ attendees: allAttendees });
            }
        } else {
            form.setFieldsValue({ attendees: filteredValue });
        }
    };

    const renderItemOption = (item) => {
        const color = item.level?.color || '白色';
        return (
            <Select.Option key={item.name} value={item.name}>
                <span style={{ color: colorMapping[color] || '#000000' }}>{item.name}</span>
            </Select.Option>
        );
    };

    if (rolesLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" tip="正在載入權限信息..." />
            </div>
        );
    }

    if (!userRoles.includes('admin') && !userRoles.includes('moderator')) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Alert
                    message="權限不足"
                    description="只有管理員或版主可以訪問此頁面。"
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    return (
        <div style={{
            padding: '20px',
            backgroundColor: '#f0f2f5',
            minHeight: 'calc(90vh - 64px)',
            paddingTop: '84px',
            boxSizing: 'border-box'
        }}>
            <Card
                title={
                    <Row justify="space-between" align="middle">
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>首領消滅記錄</h2>
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
                        <Form.Item
                            label={
                                <span>
                                    貼上旅團日誌（可自動填寫表單）
                                    <Text type="secondary" style={{ marginLeft: 8 }}>
                                        格式示例：消滅時間 2025.04.12-23.02.41 或 2025.04.12 23:02:41
                                    </Text>
                                </span>
                            }
                            style={{ marginBottom: 16 }}
                        >
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <TextArea
                                    rows={6}
                                    value={logText}
                                    onChange={(e) => setLogText(e.target.value)}
                                    placeholder="請貼上旅團日誌內容..."
                                />
                                <Button type="primary" onClick={parseLogAndFillForm}>
                                    解析並填寫表單
                                </Button>
                            </Space>
                        </Form.Item>

                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="bossId"
                                    label="首領名稱"
                                    rules={[{ required: true, message: '請選擇首領！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <Select
                                        placeholder="選擇首領"
                                        allowClear
                                    >
                                        {bosses.map(boss => (
                                            <Option key={boss._id} value={boss._id}>
                                                {boss.name}
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                                <Form.Item
                                    name="kill_time"
                                    label="消滅時間"
                                    rules={[{ required: true, message: '請選擇消滅時間！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <DatePicker
                                        showTime
                                        format="YYYY-MM-DD HH:mm"
                                        value={date}
                                        onChange={(date) => setDate(date)}
                                        style={{ width: '100%' }}
                                        getPopupContainer={trigger => trigger.parentElement}
                                        disabledDate={(current) => current && current > moment().endOf('day')}
                                    />
                                </Form.Item>
                                <Form.List name="item_names">
                                    {(fields, { add, remove }) => (
                                        <>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <Row gutter={16} key={key} style={{ marginBottom: 16 }}>
                                                    <Col xs={24} sm={22}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, 'name']}
                                                            rules={[{ required: true, message: '請選擇戰利品！' }]}
                                                        >
                                                            <Select
                                                                placeholder="選擇戰利品"
                                                                allowClear
                                                                dropdownRender={(menu) => (
                                                                    <>
                                                                        {menu}
                                                                        <Space style={{ padding: '8px', borderTop: '1px solid #e8e8e8' }}>
                                                                            <Button
                                                                                type="link"
                                                                                icon={<PlusOutlined />}
                                                                                onClick={() => setAddItemModalVisible(true)}
                                                                                style={{ width: '100%', textAlign: 'left' }}
                                                                            >
                                                                                新增物品
                                                                            </Button>
                                                                        </Space>
                                                                    </>
                                                                )}
                                                            >
                                                                {items.map(item => renderItemOption(item))}
                                                            </Select>
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} sm={2}>
                                                        <Button
                                                            type="link"
                                                            onClick={() => remove(name)}
                                                            icon={<DeleteOutlined />}
                                                        />
                                                    </Col>
                                                </Row>
                                            ))}
                                            <Form.Item>
                                                <Button
                                                    type="dashed"
                                                    onClick={() => add()}
                                                    block
                                                    icon={<PlusOutlined />}
                                                >
                                                    添加戰利品
                                                </Button>
                                            </Form.Item>
                                        </>
                                    )}
                                </Form.List>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="attendees"
                                    label={
                                        <span>
                                            戰鬥參與者{' '}
                                            {form.getFieldValue('attendees')?.length > 0 && (
                                                <span>({form.getFieldValue('attendees').length} 已選)</span>
                                            )}
                                        </span>
                                    }
                                    rules={[{ required: true, message: '請至少選擇一名參與者！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        style={{ width: '100%' }}
                                        placeholder="請選擇戰鬥參與者（可多選）"
                                        onChange={handleAttendeesChange}
                                        options={userOptions.attendees}
                                        showSearch
                                        filterOption={(input, option) =>
                                            option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                        }
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="itemHolder"
                                    label="戰利品持有人"
                                    style={{ marginBottom: 16 }}
                                >
                                    <Select
                                        allowClear
                                        style={{ width: '100%' }}
                                        placeholder="請選擇戰利品持有人"
                                        options={userOptions.itemHolder}
                                        showSearch
                                        filterOption={(input, option) =>
                                            option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                        }
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item
                            name="screenshots"
                            label="補充圖片（可選，最多5張，若未上傳則使用預設圖片）"
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

            {/* 新增物品模態框 */}
            <Modal
                title="新增物品"
                open={addItemModalVisible}
                onCancel={() => {
                    setAddItemModalVisible(false);
                    itemForm.resetFields();
                }}
                footer={null}
            >
                <Form
                    form={itemForm}
                    layout="vertical"
                    onFinish={handleAddItem}
                >
                    <Form.Item
                        name="name"
                        label="物品名稱"
                        rules={[{ required: true, message: '請輸入物品名稱！' }]}
                    >
                        <Input placeholder="輸入物品名稱" />
                    </Form.Item>
                    <Form.Item
                        name="type"
                        label="類型"
                        rules={[{ required: true, message: '請選擇物品類型！' }]}
                    >
                        <Select placeholder="選擇類型">
                            <Option value="equipment">裝備</Option>
                            <Option value="skill">技能</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="level"
                        label="等級"
                        rules={[{ required: true, message: '請選擇物品等級！' }]}
                    >
                        <Select placeholder="選擇等級">
                            {itemLevels.map(level => (
                                <Option key={level._id} value={level._id}>
                                    <Tag color={colorMapping[level.color]}>{level.level}</Tag>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label="描述（可選）"
                    >
                        <Input.TextArea placeholder="輸入描述" />
                    </Form.Item>
                    <Form.Item
                        name="imageUrl"
                        label="圖片 URL（可選）"
                        rules={[{ type: 'url', message: '請輸入有效的 URL 地址' }]}
                    >
                        <Input placeholder="輸入圖片 URL" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            提交
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            <style jsx>{`
                .ant-upload-list-picture-card .ant-upload-list-item {
                    margin: 12px;
                    border: 1px solid #d9d9d9;
                    borderRadius: 4px;
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