import axios from 'axios';

export default class DoubaoClient {
  constructor(apiKey, endpoint = 'https://ark.cn-beijing.volces.com/api/v3') {
    this.apiKey = apiKey;
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  async chat({ model, systemPrompt, userPrompt, maxTokens = 2048, temperature = 0.3 }) {
    const maxRetry = 3;
    let attempt = 0;
    const delay = (ms) => new Promise(res=>setTimeout(res,ms));

    while (true) {
      try {
        return await this._doChat({ model, systemPrompt, userPrompt, maxTokens, temperature });
      } catch (err) {
        attempt++;
        const isRetryable = [429, 500, 502, 503, 504].includes(err.statusCode || err.response?.status);
        if (attempt > maxRetry || !isRetryable) throw err;
        const backoff = 500 * 2 ** (attempt - 1) + Math.random() * 200;
        await delay(backoff);
      }
    }
  }

  async _doChat({ model, systemPrompt, userPrompt, maxTokens, temperature }) {
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
      const status = err.response?.status;
      const newErr = new Error(err.response?.data?.error?.message || err.message);
      newErr.statusCode = status;
      throw newErr;
    }
  }
}