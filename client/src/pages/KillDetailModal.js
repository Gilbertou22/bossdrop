import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Divider, Image, Spin, Tag, Typography, Button, Select, Form, message } from 'antd';
import { UserOutlined, ClockCircleOutlined, TeamOutlined, GiftOutlined, CheckCircleOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import moment from 'moment';
import axios from 'axios';

const { Text } = Typography;
const BASE_URL = 'http://localhost:5000';

const KillDetailModal = ({ visible, onCancel, killData, onUpdate, token, initialEditing = false }) => {
    const [isEditing, setIsEditing] = useState(initialEditing);
    const [form] = Form.useForm();
    const [availableUsers, setAvailableUsers] = useState([]); // 可用參與者列表

    // 監聽 visible 和 initialEditing 變化，動態更新 isEditing
    useEffect(() => {
        if (visible) {
            setIsEditing(initialEditing);
        }
    }, [visible, initialEditing]);

    // 獲取可用參與者列表
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/users`, {
                    headers: { 'x-auth-token': token },
                });
                setAvailableUsers(res.data.map(user => user.character_name));
            } catch (err) {
                console.error('Fetch users error:', err);
                message.error('載入用戶列表失敗');
            }
        };
        if (visible && isEditing) fetchUsers();
    }, [visible, isEditing, token]);

    // 初始化表單數據
    useEffect(() => {
        if (visible && killData) {
            form.setFieldsValue({
                status: killData.status,
                attendees: killData.attendees || [],
            });
        }
    }, [visible, killData, form]);

    const getStatusTag = (status) => {
        let color, text;
        switch (status) {
            case 'pending':
                color = 'gold';
                text = '待分配';
                break;
            case 'assigned':
                color = 'green';
                text = '已分配';
                break;
            case 'expired':
                color = 'red';
                text = '已過期';
                break;
            default:
                color = 'default';
                text = status || '未知';
        }
        return (
            <Tag
                color={color}
                style={{
                    borderRadius: '12px',
                    padding: '2px 12px',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
            >
                {text}
            </Tag>
        );
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        form.resetFields();
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            const res = await axios.put(
                `${BASE_URL}/api/boss-kills/${killData._id}`,
                values,
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg || '更新成功！');
            setIsEditing(false);
            onUpdate(); // 通知父組件刷新數據
        } catch (err) {
            console.error('Update kill detail error:', err);
            message.error(`更新失敗: ${err.response?.data?.msg || err.message}`);
        }
    };

    return (
        <Modal
            title="擊殺記錄詳情"
            visible={visible}
            onCancel={onCancel}
            footer={
                isEditing ? [
                    <Button key="cancel" onClick={handleCancelEdit}>
                        取消
                    </Button>,
                    <Button key="save" type="primary" onClick={handleSave}>
                        保存
                    </Button>,
                ] : [
                    killData?.status === 'pending' && (
                        <Button key="edit" type="primary" icon={<EditOutlined />} onClick={handleEdit}>
                            編輯
                        </Button>
                    ),
                    <Button key="close" onClick={onCancel}>
                        關閉
                    </Button>,
                ]
            }
            width={800}
        >
            <Spin spinning={false}>
                {killData ? (
                    <div>
                        <Form form={form}>
                            <Descriptions
                                column={2}
                                size="middle"
                                bordered
                                style={{ marginBottom: '24px' }}
                                labelStyle={{ width: '120px', fontWeight: 'bold' }}
                                contentStyle={{ fontSize: '14px' }}
                            >
                                <Descriptions.Item label={<><UserOutlined /> 首領名稱</>}>
                                    {killData.boss_name || '未知首領'}
                                </Descriptions.Item>
                                <Descriptions.Item label={<><ClockCircleOutlined /> 擊殺時間</>}>
                                    {moment(killData.kill_time).format('YYYY-MM-DD HH:mm')}
                                </Descriptions.Item>
                                <Descriptions.Item label={<><CheckCircleOutlined /> 狀態</>}>
                                    {isEditing ? (
                                        <Form.Item name="status" noStyle>
                                            <Select style={{ width: '120px' }}>
                                                <Select.Option value="pending">待分配</Select.Option>
                                                <Select.Option value="assigned">已分配</Select.Option>
                                                <Select.Option value="expired">已過期</Select.Option>
                                            </Select>
                                        </Form.Item>
                                    ) : (
                                        getStatusTag(killData.status)
                                    )}
                                </Descriptions.Item>
                                <Descriptions.Item label={<><GiftOutlined /> 掉落物品</>} span={2}>
                                    <div>
                                        {killData.dropped_items.length > 0 ? (
                                            killData.dropped_items.map((item, index) => (
                                                <Text key={index} style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                                                     {item.name} ({item.type})
                                                </Text>
                                            ))
                                        ) : (
                                            <Text style={{ fontSize: '14px' }}>無</Text>
                                        )}
                                    </div>
                                </Descriptions.Item>
                                <Descriptions.Item label={<><TeamOutlined /> 參與者</>} span={2}>
                                    {isEditing ? (
                                        <Form.Item name="attendees" noStyle>
                                            <Select
                                                mode="multiple"
                                                style={{ width: '100%' }}
                                                placeholder="選擇參與者"
                                                allowClear
                                                options={availableUsers.map(user => ({ label: user, value: user }))}
                                            />
                                        </Form.Item>
                                    ) : (
                                        <Text style={{ fontSize: '14px' }}>
                                            {killData.attendees?.join(', ') || '無'}
                                        </Text>
                                    )}
                                </Descriptions.Item>
                                <Descriptions.Item label={<><UserOutlined /> 最終獲得者</>}>
                                    <Text style={{ fontSize: '14px' }}>
                                        {killData.final_recipient || '未分配'}
                                    </Text>
                                </Descriptions.Item>
                            </Descriptions>
                        </Form>
                        {killData.screenshots.length > 0 && (
                            <div>
                                <Divider orientation="left">截圖</Divider>
                                <Image.PreviewGroup>
                                    {killData.screenshots.map((src, index) => (
                                        <Image
                                            key={index}
                                            src={src}
                                            alt={`截圖 ${index + 1}`}
                                            style={{
                                                width: '200px',
                                                marginRight: '8px',
                                                marginBottom: '8px',
                                                border: '1px solid #d9d9d9',
                                                borderRadius: '4px',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                                position: 'relative',
                                                zIndex: 0,
                                            }}
                                            preview={{
                                                mask: '點擊預覽',
                                                toolbarRender: () => (
                                                    <span>預覽</span>
                                                ),
                                                onVisibleChange: (visible) => {
                                                    if (visible) console.log('Preview opened');
                                                },
                                            }}
                                        />
                                    ))}
                                </Image.PreviewGroup>
                            </div>
                        )}
                    </div>
                ) : (
                    <div>無數據</div>
                )}
                <style jsx global>{`
                .ant-image .ant-image-mask {
                    position: static !important; /* 覆蓋 Ant Design 的 position: relative */
                }
                .ant-descriptions-item-label {
                    background-color: #f5f5f5;
                    padding: 8px 16px;
                }
                .ant-descriptions-item-content {
                    padding: 8px 16px;
                }
            `}</style>
            </Spin>
        </Modal>
    );
};

export default KillDetailModal;