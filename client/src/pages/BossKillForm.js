import React, { useState, useEffect } from 'react';
import { Form, Button, Upload, AutoComplete, Select, message, DatePicker, Input, Row, Col } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

const BossKillForm = () => {
    const [fileList, setFileList] = useState([]);
    const [form] = Form.useForm();
    const [bosses, setBosses] = useState([]);
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [bossOptions, setBossOptions] = useState([]);
    const [itemOptions, setItemOptions] = useState([]);
    const [userOptions, setUserOptions] = useState([]);
    const [date, setDate] = useState(new Date());

    useEffect(() => {
        fetchBosses();
        fetchItems();
        fetchUsers();
        const defaultKillTime = moment(); // 明確定義當前時間
        form.setFieldsValue({ kill_time: null }); // 同步設置表單值
    }, []);

    const fetchBosses = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/bosses');
            setBosses(res.data);
            setBossOptions(res.data.map(boss => ({ value: boss.name })));
        } catch (err) {
            message.error('載入首領失敗');
        }
    };

    const fetchItems = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/items');
            setItems(res.data);
            setItemOptions(res.data.map(item => ({ value: item.name, type: item.type })));
        } catch (err) {
            message.error('載入物品失敗');
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/users', {
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

    const onFinish = (values) => {
        console.log('onFinish triggered with values:', values); // 調試：確認觸發
        if (fileList.length === 0) {
            message.error('請至少上傳一張截圖！');
            return;
        }

        // 使用 confirm 替代 Modal.confirm
        if (window.confirm(
            `確認提交以下信息？\n\n` +
            `- 首領名稱: ${values.boss_name}\n` +
            `- 擊殺時間: ${values.kill_time ? values.kill_time.format('YYYY-MM-DD HH:mm') : ''}\n` +
            `- 掉落物品: ${values.item_name}\n` +
            `- 出席成員: ${Array.isArray(values.attendees) ? values.attendees.join(', ') : ''}\n` +
            `- 截圖數量: ${fileList.length} 張`
        )) {
            handleSubmit(values);
        } else {
            console.log('Submission cancelled');
        }
    };

    const handleSubmit = async (values) => {
        console.log('handleSubmit triggered with values:', values); // 調試：確認觸發
        const formData = new FormData();
        formData.append('boss_name', values.boss_name);
        formData.append('kill_time', values.kill_time.toISOString());
        const droppedItem = {
            name: values.item_name,
            type: items.find(i => i.name === values.item_name)?.type || 'equipment',
        };
        formData.append('dropped_items', JSON.stringify([droppedItem]));
        const attendeesArray = Array.isArray(values.attendees) ? values.attendees : [];
        formData.append('attendees', JSON.stringify(attendeesArray));
        fileList.forEach(file => formData.append('screenshots', file.originFileObj));

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                message.error('請先登錄！');
                window.location.href = '/login';
                return;
            }
            console.log('Sending request...'); // 調試
            const res = await axios.post('http://localhost:5000/api/boss-kills', formData, {
                headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
            });
            console.log('API response:', res.data); // 調試
            console.log('Before alert'); // 調試
            alert(`擊殺記錄成功！ID: ${res.data.kill_id}`); // 確保執行
            console.log('After alert'); // 調試
            form.resetFields();
            setFileList([]);
            form.setFieldsValue({ kill_time: moment() });
        } catch (err) {
            message.error(`提交失敗: ${err.response?.data?.msg || err.message}`);
            if (err.response?.status === 401 || err.response?.status === 403) {
                window.location.href = '/login';
            }
            console.error('Error details:', err); // 調試
        }
    };

    const uploadProps = {
        onChange: ({ fileList: newFileList }) => {
            setFileList(newFileList.slice(-5));
        },
        beforeUpload: file => {
            if (file.size > 600 * 1024) {
                message.error('圖片大小不得超過600KB！');
                return Upload.LIST_IGNORE;
            }
            return false;
        },
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
            // 選擇全部時，設置為所有 userOptions
            const allAttendees = userOptions.map(option => option.value);
            form.setFieldsValue({ attendees: allAttendees });
        } else {
            form.setFieldsValue({ attendees: value.filter(val => val !== 'all') });
        }
        console.log('Selected attendees:', value);
    };

    return (
        <div style={{ maxWidth: 1000, margin: '50px auto' }}>
            <h2>記錄擊殺</h2>
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
                    <Col span={12}>
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
                                getValueFromEvent={(date, dateString) => (date ? date : null)} // 傳遞 moment 對象
                            />
                        </Form.Item>
                        <Form.Item
                            name="kill_time"
                            label="擊殺時間"
                            rules={[{ required: true, message: '請選擇擊殺時間！' }]}
                            style={{ marginBottom: 16 }}
                        >
                            <DatePicker
                                format="YYYY-MM-DD HH:mm" // 增加時間顯示
                                showTime={{ format: 'HH:mm' }} // 明確指定時間格式
                                selected={date}
                                onChange={(date) => setDate(date)}
                                style={{ width: '100%' }}
                                getPopupContainer={trigger => trigger.parentElement}
                            />
                        </Form.Item>
                        <Form.Item
                            name="item_name"
                            label="掉落物品"
                            rules={[{ required: true, message: '請輸入或選擇物品名稱！' }]}
                            style={{ marginBottom: 16 }}
                        >
                            <AutoComplete
                                options={itemOptions}
                                onSearch={handleItemSearch}
                                placeholder="輸入或選擇物品名稱"
                                onChange={(value) => {
                                    const item = items.find(i => i.name === value);
                                    form.setFieldsValue({ item_type: item?.type || '' });
                                }}
                                autoComplete="off"
                            />
                        </Form.Item>
                        <Form.Item
                            name="item_type"
                            label="物品類型"
                            style={{ marginBottom: 16 }}
                        >
                            <Input disabled autoComplete="off" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
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
                    label="截圖（至少1張，最多5張）"
                    rules={[{ required: true, message: '請至少上傳一張截圖！' }]}
                    style={{ marginBottom: 16, marginTop: 16 }}
                >
                    <Upload {...uploadProps}>
                        <Button icon={<UploadOutlined />}>上傳截圖</Button>
                    </Upload>
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" block>
                        提交
                    </Button>
                </Form.Item>
            </Form>
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