import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Spin, Switch, Row, Col, Alert, InputNumber } from 'antd';
import MarkdownEditor from 'react-markdown-editor-lite';
import MarkdownIt from 'markdown-it';
import axios from 'axios';
import 'react-markdown-editor-lite/lib/index.css';

const BASE_URL = 'http://localhost:5000';

const GuildSettings = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [guild, setGuild] = useState(null);
    const [online, setOnline] = useState(navigator.onLine);
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchGuild();

        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));
    }, []);

    const fetchGuild = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/guilds/67d234a70eb49dbaf1287ec1`, { // 假設有 guildId
                headers: { 'x-auth-token': token },
            });
            setGuild(res.data);
            form.setFieldsValue({
                password: res.data.password,
                announcement: res.data.announcement,
                applyDeadlineHours: res.data.settings.applyDeadlineHours,
                editDeadlineHours: res.data.settings.editDeadlineHours,
                deleteDeadlineHours: res.data.settings.deleteDeadlineHours,
                publicFundRate: res.data.settings.publicFundRate * 100, // 轉為百分比
                creatorExtraShare: res.data.settings.creatorExtraShare,
                leaderExtraShare: res.data.settings.leaderExtraShare,
                restrictBilling: res.data.settings.restrictBilling,
                withdrawMinAmount: res.data.settings.withdrawMinAmount,
            });
        } catch (err) {
            message.error('載入團隊設定失敗: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoading(false);
        }
    };

    const onFinish = async (values) => {
        if (!online) {
            message.error('目前處於離線模式，無法更新設定');
            return;
        }
        setLoading(true);
        try {
            const settings = {
                applyDeadlineHours: values.applyDeadlineHours,
                editDeadlineHours: values.editDeadlineHours,
                deleteDeadlineHours: values.deleteDeadlineHours,
                publicFundRate: values.publicFundRate / 100, // 轉回小數
                creatorExtraShare: values.creatorExtraShare,
                leaderExtraShare: values.leaderExtraShare,
                restrictBilling: values.restrictBilling,
                withdrawMinAmount: values.withdrawMinAmount,
            };
            await axios.put(`${BASE_URL}/api/guilds/67d234a70eb49dbaf1287ec1`, { // 假設有 guildId
                password: values.password,
                announcement: values.announcement,
                settings,
            }, {
                headers: { 'x-auth-token': token },
            });
            message.success('團隊設定更新成功！');
            fetchGuild();
        } catch (err) {
            message.error('更新團隊設定失敗: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleEditorChange = ({ text }) => {
        form.setFieldsValue({ announcement: text });
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>管理旅團</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <Spin spinning={loading}>
                    <Form
                        form={form}
                        onFinish={onFinish}
                        layout="vertical"
                        style={{ maxWidth: '100%' }}
                    >
                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="password"
                                    label="團隊密碼"
                                    rules={[{ required: true, message: '請輸入團隊密碼！' }]}
                                >
                                    <Input.Password placeholder="輸入團隊密碼" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item
                            name="announcement"
                            label="團隊公告（支援 Markdown 語法）"
                        >
                            <MarkdownEditor
                                value={form.getFieldValue('announcement') || ''}
                                onChange={handleEditorChange}
                                style={{ height: '300px' }}
                                renderHTML={text => new MarkdownIt().render(text)}
                            />
                        </Form.Item>
                        <h3>開單分鑽設定</h3>
                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="applyDeadlineHours"
                                    label="補單期限（小時）"
                                    rules={[
                                        { required: true, message: '請輸入補單期限！' },
                                        { type: 'number', min: 0, message: '補單期限不能小於 0！' },
                                    ]}
                                    tooltip="建議不超過 48 小時，避免入帳延遲"
                                >
                                    <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="editDeadlineHours"
                                    label="編輯期限（小時）"
                                    rules={[
                                        { required: true, message: '請輸入編輯期限！' },
                                        { type: 'number', min: 0, message: '編輯期限不能小於 0！' },
                                    ]}
                                    tooltip="建議不要太長，避免補單後內容被修改"
                                >
                                    <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="deleteDeadlineHours"
                                    label="刪除期限（小時）"
                                    rules={[
                                        { required: true, message: '請輸入刪除期限！' },
                                        { type: 'number', min: 0, message: '刪除期限不能小於 0！' },
                                    ]}
                                    tooltip="建議不要太長，通常用於重複開單"
                                >
                                    <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="publicFundRate"
                                    label="公基金比例（%）"
                                    rules={[
                                        { required: true, message: '請輸入公基金比例！' },
                                        { type: 'number', min: 0, max: 100, message: '公基金比例必須在 0-100 之間！' },
                                    ]}
                                    tooltip="每張單的收入將依此比例抽取進入公基金"
                                >
                                    <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="creatorExtraShare"
                                    label="開單者多領一份"
                                    valuePropName="checked"
                                    tooltip="開單者可多領一份（參與則領兩份，未參與也有一份）"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="leaderExtraShare"
                                    label="帶團者多領一份"
                                    valuePropName="checked"
                                    tooltip="辛苦的帶團者可多領一份"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="restrictBilling"
                                    label="限制開單"
                                    valuePropName="checked"
                                    tooltip="僅擁有「開單者」權限的盟友可開單"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="withdrawMinAmount"
                                    label="提領限制（最小金額）"
                                    rules={[
                                        { required: true, message: '請輸入最小提領金額！' },
                                        { type: 'number', min: 0, message: '最小提領金額不能小於 0！' },
                                    ]}
                                    tooltip="可依會計忙碌程度設定，季末結算可設為 0"
                                >
                                    <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" block disabled={loading || !online}>
                                儲存設定
                            </Button>
                        </Form.Item>
                    </Form>
                    {!online && (
                        <Alert
                            message="離線模式"
                            description="目前處於離線模式，無法更新設定。"
                            type="warning"
                            showIcon
                            style={{ marginTop: '16px' }}
                        />
                    )}
                </Spin>
            </Card>
        </div>
    );
};

export default GuildSettings;