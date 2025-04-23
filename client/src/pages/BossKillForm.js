import React, { useState, useEffect } from 'react';
import { Form, Button, Upload, Select, message, DatePicker, Input, Row, Col, Alert, Spin, Card, Space, Typography } from 'antd';
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
        guildCaptain: null, // 儲存旅團部隊長
    });
    const [date, setDate] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [logText, setLogText] = useState(''); // 儲存旅團日誌內容
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

            // 過濾出席成員：排除 role 為 GUILD 和 ADMIN 的用戶
            const filteredAttendees = res.data
                .filter(user => user.role !== 'guild' && user.role !== 'admin')
                .map(user => user.character_name);

            // 過濾物品持有人：只排除 role 為 GUILD 的用戶
            const filteredItemHolders = res.data
                .filter(user => user.role !== 'guild')
                .map(user => user.character_name);

            // 提取旅團部隊長（假設 role 為 admin）
            const guildCaptain = res.data.find(user => user.role === 'admin')?.character_name;

            setUsers(res.data.map(user => user.character_name));
            setUserOptions({
                attendees: [
                    { value: 'all', label: '選擇全部' },
                    ...filteredAttendees.map(name => ({ value: name, label: name }))
                ],
                itemHolder: filteredItemHolders.map(name => ({ value: name, label: name })),
                guildCaptain, // 保存旅團部隊長
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

    // 載入預設圖片並轉換為 File 對象
    const getDefaultImage = async () => {
        try {
            const response = await fetch('/wp.jpg'); // 假設 wp.jpg 在 public 資料夾中
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

    // 解析旅團日誌並自動填寫表單
    const parseLogAndFillForm = () => {
        try {
            // 按行分割日誌
            const lines = logText.split('\n').map(line => line.trim()).filter(line => line);

            // 解析第一行（表頭）和第二行（內容）
            const headerLine = lines[0]; // 消滅時間 地點 首領 總參與人數 旅團部隊長 分配方式
            const contentLine = lines[1]; // 2025.04.12-23.02.41 冰封瀑布 哀嘆的女王普蘭 10 伊莉斯 旅團部隊長獲得(英雄)

            // 按 TAB 或 4 個空格分隔表頭和內容
            const headers = headerLine.split(/\t| {4}/).map(h => h.trim());
            const contents = contentLine.split(/\t| {4}/).map(c => c.trim());

         

            // 驗證字段數量
            if (headers.length !== contents.length) {
                message.error(`日誌格式錯誤：表頭字段數 (${headers.length}) 與內容字段數 (${contents.length}) 不一致`);
                return;
            }

            // 創建字段映射
            const logData = {};
            headers.forEach((header, index) => {
                logData[header] = contents[index];
            });

            // 提取消滅時間
            const timeStr = logData['消滅時間']; // 2025.04.12-23.02.41
            let killTime = null;
            if (timeStr) {
                const timeRegex = /(\d{4}\.\d{2}\.\d{2})[- ](\d{2}\.\d{2}\.\d{2}|\d{2}:\d{2}:\d{2})/;
                const match = timeStr.match(timeRegex);
                if (match) {
                    const datePart = match[1]; // 2025.04.12
                    let timePart = match[2]; // 23.02.41 或 23:02:41
                    timePart = timePart.replace(/\./g, ':'); // 將 23.02.41 轉為 23:02:41
                    const formattedTime = `${datePart.replace(/\./g, '-')} ${timePart}`; // 2025-04-12 23:02:41
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

            // 提取首領
            const bossName = logData['首領']; // 哀嘆的女王普蘭
            if (bossName) {
                const boss = bosses.find(b => b.name === bossName);
                if (boss) {
                    form.setFieldsValue({ bossId: boss._id });
                } else {
                    message.warning(`未找到首領 ${bossName}，請手動選擇`);
                }
            }

            // 提取分配方式（物品持有人）
            const distribution = logData['分配方式']; // 旅團部隊長獲得(英雄)
            const guildCaptainName = logData['旅團部隊長']; // 伊莉斯
            if (distribution) {
                // 檢查是否為旅團部隊長獲得
                if (distribution.includes('旅團部隊長獲得')) {
                    if (guildCaptainName && users.includes(guildCaptainName)) {
                        form.setFieldsValue({ itemHolder: guildCaptainName });
                        message.success(`已自動選擇旅團部隊長 ${guildCaptainName} 作為戰利品持有人`);
                    } else {
                        message.warning('未找到旅團部隊長或旅團部隊長不在用戶列表中，請手動選擇物品持有人');
                    }
                } else {
                    // 嘗試匹配具體的物品持有人
                    const holderMatch = distribution.match(/物品持有人,\s*([^ ]+)/);
                    if (holderMatch) {
                        const itemHolder = holderMatch[1]; // 伊莉斯
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

            // 提取戰鬥參與者
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

            // 提取戰利品
            const itemsStartIndex = lines.findIndex(line => line.startsWith('戰利品'));
            if (itemsStartIndex !== -1) {
                const itemsLines = lines.slice(itemsStartIndex + 1);
                const droppedItems = itemsLines
                    .map(line => {
                        const parts = line.split(/\t| {4}/).map(part => part.trim());
                        if (parts.length >= 2) {
                            const itemName = parts[0]; // 戰利品名稱
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
        // 移除對 fileList 的必填檢查
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

            // 如果用戶未上傳圖片，使用預設圖片 wp.jpg
            if (fileList.length === 0) {
                /*
                const defaultImage = await getDefaultImage();
                if (defaultImage) {
                    formData.append('screenshots', defaultImage);
                } else {
                    setLoading(false);
                    return; // 如果無法載入預設圖片，停止提交
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
            setLogText(''); // 清空日誌輸入框
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
                        {/* 旅團日誌輸入框 */}
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