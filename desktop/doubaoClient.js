import axios from 'axios';

export default class DoubaoClient {
  constructor(apiKey, endpoint = 'https://ark.cn-beijing.volces.com/api/v3') {
    this.apiKey = apiKey;
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  async chat({ model, systemPrompt, userPrompt, maxTokens = 2048, temperature = 0.3 }) {
    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature,
      stream: false
    };

    try {
      const res = await axios.post(`${this.endpoint}/chat/completions`, body, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      return res.data.choices[0].message.content;
    } catch (err) {
      throw new Error(err.response?.data?.error?.message || err.message);
    }
  }
}